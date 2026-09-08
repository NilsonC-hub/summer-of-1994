"""1994 desk: authored in Blender, metres, Z up. Run stages in the visible session."""
import bpy, math, os, json
from mathutils import Vector
from pathlib import Path

ROOT = Path(os.environ.get('I486_ROOT', 'E:/i486'))
ASSETS = ROOT / 'public/assets'
SCENE = '1994 - The borrowed disk'
M = {}

def material(name, color, rough=.5, metal=0, emission=None):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    # These are generator-owned materials. Rebuilding must not retain old texture links.
    mat.node_tree.nodes.clear()
    bs = mat.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
    output = mat.node_tree.nodes.new('ShaderNodeOutputMaterial')
    mat.node_tree.links.new(bs.outputs['BSDF'], output.inputs['Surface'])
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Roughness'].default_value = rough
    bs.inputs['Metallic'].default_value = metal
    if emission:
        bs.inputs['Emission Color'].default_value = (*color, 1)
        bs.inputs['Emission Strength'].default_value = emission
    mat.diffuse_color = (*color, 1)
    M[name] = mat
    return mat

def collection(name):
    c = bpy.data.collections.get(name)
    if not c:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
    return c

def relink(obj, cname):
    for c in list(obj.users_collection): c.objects.unlink(obj)
    collection(cname).objects.link(obj)
    return obj

def finish(obj, name, mat, cname, parent=None):
    obj.name = name
    if mat: obj.data.materials.append(M[mat] if isinstance(mat,str) else mat)
    relink(obj,cname)
    if parent:
        mw = obj.matrix_world.copy()
        obj.parent = parent
        obj.matrix_world = mw
    return obj

def box(name, loc, size, mat='ABS_Ivory', bevel=.003, cname='Hardware', parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o=bpy.context.object
    o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Machined edge radius','BEVEL'); mod.width=bevel; mod.segments=3
        mod=o.modifiers.new('Weighted surface normals','WEIGHTED_NORMAL')
        for p in o.data.polygons: p.use_smooth=True
    return finish(o,name,mat,cname,parent)

def cylinder(name, loc, radius, depth, mat, cname='Hardware', rotation=None, parent=None, vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    o=bpy.context.object
    if rotation:o.rotation_euler=rotation
    bevel=o.modifiers.new('Turned edge','BEVEL');bevel.width=min(.0015,depth*.12);bevel.segments=3
    o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    for p in o.data.polygons:p.use_smooth=True
    return finish(o,name,mat,cname,parent)

def empty(name,loc=(0,0,0),cname='Hardware'):
    o=bpy.data.objects.new(name,None);collection(cname).objects.link(o);o.location=loc;return o

def text_obj(name, text, loc, size=.005, mat='Ink', rotation=(math.pi/2,0,0), cname='Hardware', parent=None, align='LEFT'):
    curve=bpy.data.curves.new(name,'FONT');curve.body=text;curve.size=size;curve.align_x=align
    curve.extrude=0;curve.resolution_u=3
    fontpath='C:/Windows/Fonts/arial.ttf'
    if os.path.exists(fontpath):
        curve.font=bpy.data.fonts.get('Arial Regular') or bpy.data.fonts.load(fontpath)
    obj=bpy.data.objects.new(name,curve);collection(cname).objects.link(obj)
    obj.location=loc;obj.rotation_euler=rotation;curve.materials.append(M[mat])
    if parent:
        mw=obj.matrix_world.copy();obj.parent=parent;obj.matrix_world=mw
    return obj

def cable(name, points, radius=.0025, mat='Cable', cname='Hardware'):
    cr=bpy.data.curves.new(name,'CURVE');cr.dimensions='3D';cr.resolution_u=12
    spl=cr.splines.new('BEZIER');spl.bezier_points.add(len(points)-1)
    for p,co in zip(spl.bezier_points,points):
        p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    cr.bevel_depth=radius;cr.bevel_resolution=3
    ob=bpy.data.objects.new(name,cr);collection(cname).objects.link(ob);cr.materials.append(M[mat]);return ob

def rounded_loop(w,h,r,zcenter,segments=8):
    pts=[]
    for cx,cz,start in [(w/2-r,h/2-r,0),(-w/2+r,h/2-r,90),(-w/2+r,-h/2+r,180),(w/2-r,-h/2+r,270)]:
        for j in range(segments):
            a=math.radians(start+j*90/segments)
            pts.append((cx+r*math.cos(a),zcenter+cz+r*math.sin(a)))
    return pts

def loft(name,rings,mat,cname='Hardware',cap=False):
    verts=[]
    for y,w,h,r,zc in rings: verts.extend((x,y,z) for x,z in rounded_loop(w,h,r,zc))
    n=32;faces=[]
    for j in range(len(rings)-1):
        for i in range(n):faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
    if cap:faces.extend([tuple(reversed(range(n))),tuple((len(rings)-1)*n+i for i in range(n))])
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    ob=bpy.data.objects.new(name,me);collection(cname).objects.link(ob);me.materials.append(M[mat])
    for p in me.polygons:p.use_smooth=True
    return ob

def rounded_screen_mesh():
    """Rounded glass boundary, planar UV projection and a shallow CRT bulge."""
    w=.270;h=.204;zc=1.155;n=64;nr=18
    outline=rounded_loop(w,h,.009,0,16)
    vs=[(0,-.226,zc)];uvs=[(.5,.5)]
    for ring in range(1,nr+1):
        t=ring/nr
        for x,z in outline:
            x*=t;z*=t;u=x/w+.5;v=z/h+.5
            depth=.004*(1-(2*u-1)**2)*(1-(2*v-1)**2)
            vs.append((x,-.222-depth,zc+z));uvs.append((u,v))
    faces=[]
    for i in range(n):faces.append((0,1+i,1+(i+1)%n))
    for r in range(nr-1):
        a=1+r*n;b=a+n
        for i in range(n):faces.append((a+i,b+i,b+(i+1)%n,a+(i+1)%n))
    me=bpy.data.meshes.new('CRT glass with rounded boundary');me.from_pydata(vs,[],faces);me.update()
    # Boundary traversal is CCW in XZ, giving outward -Y normals.
    uv=me.uv_layers.new(name='ScreenUV')
    for p in me.polygons:
        p.use_smooth=True
        for li in p.loop_indices:uv.data[li].uv=uvs[me.loops[li].vertex_index]
    return me

def remove_generated_objects(objects):
    """Remove this generator's objects and their now-unused geometry/data blocks."""
    for obj in list(objects):
        data = obj.data
        kind = obj.type
        bpy.data.objects.remove(obj, do_unlink=True)
        if data is not None and data.users == 0:
            blocks = {'MESH': bpy.data.meshes, 'FONT': bpy.data.curves,
                      'CURVE': bpy.data.curves, 'LIGHT': bpy.data.lights,
                      'CAMERA': bpy.data.cameras}.get(kind)
            if blocks is not None:
                blocks.remove(data)


def setup(reset=False):
    if SCENE in bpy.data.scenes:
        bpy.context.window.scene=bpy.data.scenes[SCENE]
        scene=bpy.context.scene
        if not reset:
            load_materials()
            return
        remove_generated_objects(scene.objects)
    else:
        scene=bpy.data.scenes.new(SCENE);bpy.context.window.scene=scene
    (ROOT/'blender').mkdir(parents=True, exist_ok=True)
    scene.unit_settings.system='METRIC'
    material('ABS_Ivory',(.64,.615,.54),.38)
    material('ABS_Shadow',(.39,.38,.335),.47)
    material('Key_Cream',(.76,.745,.67),.42)
    material('Key_Grey',(.39,.42,.40),.48)
    material('Ink',(.06,.068,.055),.58)
    material('Black',(.012,.017,.018),.48)
    material('Cable',(.06,.065,.058),.56)
    material('Steel',(.53,.55,.56),.24,.85)
    material('Screen_Off',(.014,.021,.022),.21,.08)
    material('Green_LED',(.08,.52,.22),.28,0,1)
    material('Amber_LED',(.65,.20,.015),.28,0,.6)
    material('Wood',(.23,.105,.044),.44)
    material('Wood_Edge',(.17,.082,.035),.4)
    material('Wall',(.52,.55,.47),.95)
    material('Trim',(.73,.71,.60),.52)
    material('Floor',(.15,.105,.066),.65)
    material('Lamp_Green',(.035,.105,.07),.23,.12)
    material('Brass',(.42,.255,.085),.24,.7)
    material('Paper',(.83,.78,.63),.86)
    material('Red_Book',(.27,.062,.031),.7)
    material('Blue_Book',(.055,.12,.17),.7)
    material('Disk_Blue',(.023,.075,.105),.45)
    material('Light_Warm',(.95,.66,.30),.4,0,3)
    scene.render.engine='CYCLES';scene.cycles.samples=48
    scene.render.resolution_x=1600;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'
    world=bpy.data.worlds.get('Afternoon ambient') or bpy.data.worlds.new('Afternoon ambient');world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.48,.58,.67,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.25;scene.world=world

def stage_room():
    # Desk top and original joinery.
    box('Desk_Top',(0,0,.724),(1.65,.95,.052),'Wood',.012,'Room')
    box('Desk_Front_Edge',(0,-.470,.709),(1.62,.019,.04),'Wood_Edge',.006,'Room')
    for x in [-.72,.72]:
        for y in [-.34,.34]:box('Desk_Leg',(x,y,.355),(.065,.065,.71),'Wood_Edge',.004,'Room')
    box('Drawer_Cabinet',(-.565,.02,.595),(.34,.68,.20),'Wood',.007,'Room')
    box('Drawer_Front',(-.565,-.337,.600),(.327,.017,.173),'Wood_Edge',.004,'Room')
    box('Drawer_Handle',(-.565,-.352,.63),(.102,.014,.012),'Brass',.004,'Room')
    box('Back_Wall',(0,.76,1.20),(3.4,.09,2.6),'Wall',.003,'Room')
    box('Right_Wall',(1.52,-.3,1.2),(.09,2.1,2.6),'Wall',.003,'Room')
    box('Room_Floor',(0,-.5,-.035),(3.4,3.4,.07),'Floor',.002,'Room')
    box('Skirting_Back',(0,.70,.055),(3.0,.035,.11),'Trim',.002,'Room')
    # Window on left, open centre; glass is deliberately outside the interaction zone.
    for y in [-.5,.53]:box('Window_Vertical_Frame',(-1.14,y,1.47),(.10,.052,1.30),'Trim',.002,'Room')
    for z in [.83,2.11]:box('Window_Horizontal_Frame',(-1.14,.015,z),(.10,1.08,.052),'Trim',.002,'Room')
    box('Window_Crossbar',(-1.14,.015,1.47),(.08,1.05,.026),'Trim',.002,'Room')
    box('Window_Sill',(-1.09,.015,.82),(.22,1.2,.04),'Trim',.004,'Room')
    for i in range(14):
        o=box('Window_Blind_%02d'%i,(-1.12,.015,2.055-i*.047),(.071,1.005,.008),'Trim',.001,'Room');o.rotation_euler.y=math.radians(-18)
    cable('Blind_cord',[(-1.055,.51,1.99),(-1.055,.51,1.37),(-1.055,.51,1.11)],.0012,'Paper','Room')

def stage_computer():
    # Horizontal AT-style case; three dimensional seam and inset front panel.
    box('PC_Chassis',(0,.045,.833),(.485,.43,.135),'ABS_Ivory',.007)
    box('PC_Lid',(0,.051,.897),(.482,.421,.017),'ABS_Ivory',.004)
    box('PC_Lid_Seam',(0,.045,.886),(.486,.429,.0018),'ABS_Shadow',.0004)
    box('PC_Front_Bezel',(0,-.174,.833),(.477,.024,.119),'ABS_Ivory',.004)
    for x in [-.19,.19]:
        for y in [-.12,.2]:cylinder('Rubber_Foot',(x,y,.758),.019,.013,'Black')
    # Vents are physical recessed strips, with deeper black slots.
    for i in range(16):box('Front_Vent_%02d'%i,(-.116+i*.012,-.187,.807),(.006,.001,.041),'ABS_Shadow',.0008)
    box('Drive_Bay_Shadow',(.144,-.188,.849),(.151,.006,.058),'ABS_Shadow',.002)
    box('Drive_Bezel',(.144,-.192,.850),(.145,.008,.047),'ABS_Ivory',.002)
    slot=box('Drive_Mouth',(.137,-.197,.854),(.102,.004,.0065),'Black',.001)
    box('Drive_Shutter',(.137,-.198,.8553),(.099,.001,.0017),'ABS_Shadow',.0004)
    box('Drive_Eject_Button',(.195,-.200,.835),(.022,.006,.009),'ABS_Ivory',.0012)
    box('Drive_LED',(.089,-.197,.836),(.004,.002,.002),'Amber_LED',.0005)
    box('PC_Power_Button',(-.200,-.198,.852),(.028,.009,.024),'Key_Grey',.002)
    text_obj('Power_I','I',(-.201,-.204,.85),.009,'Paper',align='CENTER')
    box('Power_LED',(-.169,-.198,.855),(.003,.003,.003),'Green_LED',.0006)
    text_obj('Power_caption','POWER',(-.215,-.188,.831),.004)
    box('Reset_Button',(-.16,-.194,.819),(.008,.006,.008),'ABS_Ivory',.001)
    text_obj('Brand','M I C R O L I N E',(-.102,-.190,.874),.007)
    text_obj('Model','486  /  DX2',(.075,-.190,.879),.0042)
    # Case side slots and screws, visible in the orbit view.
    for i in range(20):box('Side_Vent_%02d'%i,(.243,.055+i*.006,.858),(.001,.002,.035),'ABS_Shadow',.0004)
    for x in [-.216,.216]:
        for z in [.793,.869]:cylinder('Case_Screw',(x,.262,z),.003,.002,'Steel',rotation=(math.pi/2,0,0),vertices=16)
    box('Rear_IO',(0,.263,.823),(.29,.007,.071),'Steel',.002)
    for x in [-.083,-.041,.015,.072]:box('Rear_Port',(x,.27,.833),(.028,.007,.012),'Black',.001)
    # CRT with a continuous molded bezel and deep tapered rear body.
    cylinder('Monitor_Swivel',(0,.044,.920),.10,.025,'ABS_Shadow')
    box('Monitor_Base',(0,.028,.936),(.235,.225,.025),'ABS_Ivory',.012)
    box('Monitor_Neck',(0,.074,.966),(.105,.113,.06),'ABS_Ivory',.014)
    loft('Monitor_Rear_Shell',[
        (-.166,.346,.306,.024,1.137),(-.07,.349,.306,.032,1.137),(.10,.273,.266,.045,1.14),(.20,.221,.206,.041,1.14)
    ],'ABS_Ivory',cap=True)
    loft('Monitor_Bezel',[
        (-.16,.352,.316,.012,1.137),(-.204,.352,.316,.012,1.137),(-.219,.346,.310,.011,1.137),
        (-.219,.280,.214,.011,1.155),(-.213,.270,.204,.008,1.155)
    ],'ABS_Ivory')
    for p in bpy.data.objects['Monitor_Bezel'].data.polygons[64:96]:p.use_smooth=False
    # Recessed dark seal follows the glass perimeter.
    loft('Screen_Seal',[(-.218,.278,.212,.015,1.155),(-.220,.270,.204,.013,1.155)],'Black')
    verts=[];uvs=[];faces=[];nx=40;ny=30;w=.271;h=.205
    for j in range(ny+1):
        v=j/ny
        for i in range(nx+1):
            u=i/nx;x=(u-.5)*w;z=1.155+(v-.5)*h
            bulge=.005*(1-(2*u-1)**2)*(1-(2*v-1)**2)
            verts.append((x,-.221-bulge,z));uvs.append((u,v))
    for j in range(ny):
        for i in range(nx):
            a=j*(nx+1)+i;faces.append((a,a+1,a+nx+2,a+nx+1))
    me=bpy.data.meshes.new('CRT curved glass');me.from_pydata(verts,[],faces);me.update()
    uv=me.uv_layers.new(name='ScreenUV')
    for p in me.polygons:
        p.use_smooth=True
        for li in p.loop_indices:uv.data[li].uv=uvs[me.loops[li].vertex_index]
    o=bpy.data.objects.new('Screen_Surface',me);collection('Hardware').objects.link(o);me.materials.append(M['Screen_Off'])
    box('Monitor_Power_Button',(.139,-.222,1.014),(.019,.008,.012),'Key_Grey',.002)
    cylinder('Monitor_LED',(.116,-.224,1.014),.0018,.001,'Green_LED',rotation=(math.pi/2,0,0),vertices=16)
    text_obj('Monitor_brand','M I C R O L I N E',(-.137,-.223,1.015),.0047)
    text_obj('Monitor_spec','SVGA 14',(-.137,-.222,1.004),.003)
    for x in [-.03,-.01,.01,.03]:cylinder('Monitor_Control',(x,-.219,1.013),.004,.003,'ABS_Shadow',rotation=(math.pi/2,0,0),vertices=20)
    for i in range(15):
        box('CRT_Top_Vent_%02d'%i,(-.10+i*.014,.07,1.287),(.006,.095,.001),'ABS_Shadow',.001)
    cable('Monitor_Cable',[(.03,.195,1.075),(.06,.32,.91),(.15,.32,.805),(.14,.26,.81)],.004)

def camera_light():
    scene=bpy.context.scene
    def area(name,loc,energy,color,size,target):
        d=bpy.data.lights.new(name,'AREA');d.energy=energy;d.color=color;d.shape='DISK';d.size=size
        o=bpy.data.objects.new(name,d);collection('Lighting').objects.link(o);o.location=loc
        o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();return o
    area('Window_softbox',(-1.3,-.35,1.8),100,(.77,.85,1),1.25,(0,0,.9))
    area('Warm_lamp_pool',(.59,-.03,1.27),12,(1,.67,.34),.21,(.22,-.1,.76))
    area('Camera_fill',(.45,-1.1,1.6),25,(1,.88,.70),1.8,(0,0,1))
    d=bpy.data.cameras.new('Seated first person');o=bpy.data.objects.new('Camera_Overview',d)
    collection('Lighting').objects.link(o);o.location=(.85,-1.48,1.40)
    o.rotation_euler=(Vector((0,-.02,1.00))-o.location).to_track_quat('-Z','Y').to_euler()
    d.lens=45;scene.camera=o
    for a in bpy.context.screen.areas if bpy.context.screen else []:
        if a.type=='VIEW_3D':
            a.spaces.active.region_3d.view_perspective='CAMERA'
            a.spaces.active.region_3d.view_camera_zoom=0
            a.spaces.active.shading.type='MATERIAL'
            a.spaces.active.overlay.show_overlays=False
            a.spaces.active.show_region_ui=False
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blender/1994-desk.blend'))

def stage1():
    setup(reset=True);stage_room();stage_computer();camera_light()

def load_materials():
    for mat in bpy.data.materials: M[mat.name]=mat

def stage_keyboard():
    box('Keyboard_Base',(0,-.365,.769),(.444,.168,.027),'ABS_Ivory',.009)
    box('Keyboard_Keybed',(0,-.361,.785),(.421,.146,.008),'ABS_Shadow',.004)
    # Sculpted keycaps with a shallow concave top and real gaps.
    def keycap(name,label,x,y,w=.015,h=.015,mat='Key_Cream',small=False):
        z=.797+((y+.43)/.15)*.009
        # Four outer corner loops keep the top gently dished without an exaggerated bevel.
        sizes=[(w,h,z-.009),(w,h,z-.004),(w-.003,h-.003,z+.001)]
        vs=[]
        for sw,sh,zz in sizes:
            vs.extend([(x-sw/2,y-sh/2,zz),(x+sw/2,y-sh/2,zz),(x+sw/2,y+sh/2,zz),(x-sw/2,y+sh/2,zz)])
        fs=[(3,2,1,0)]
        for j in range(2):
            for k in range(4):fs.append((j*4+k,j*4+(k+1)%4,(j+1)*4+(k+1)%4,(j+1)*4+k))
        fs.append((8,9,10,11))
        me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update()
        ob=bpy.data.objects.new(name,me);collection('Keyboard').objects.link(ob);me.materials.append(M[mat])
        mod=ob.modifiers.new('Key edge','BEVEL');mod.width=.0006;mod.segments=2
        ob.modifiers.new('Normals','WEIGHTED_NORMAL')
        text_obj(name+'_Legend',label,(x,y-.002,z+.002),.0028 if small else .004,'Ink',rotation=(0,0,0),cname='Keyboard',align='CENTER')
    left=-.202;step=.018
    keycap('Key_Esc','Esc',left,-.297,mat='Key_Grey',small=True)
    for i in range(12):keycap('Key_F%d'%(i+1),'F%d'%(i+1),left+.042+i*.0185,-.297,small=True)
    rows=[
        ('` 1 2 3 4 5 6 7 8 9 0 - ='.split(),-.325,0),
        ('Q W E R T Y U I O P [ ]'.split(),-.346,.027),
        ('A S D F G H J K L ; \"'.split(),-.367,.035),
        ('Z X C V B N M , . /'.split(),-.388,.044),
    ]
    for labels,y,offset in rows:
        for i,label in enumerate(labels):keycap('Key_'+str(ord(label[0])),label,left+offset+i*step,y)
    keycap('Key_Backspace','Back',.036,-.325,.029,mat='Key_Grey',small=True)
    keycap('Key_Tab','Tab',left+.003,-.346,.023,mat='Key_Grey',small=True)
    keycap('Key_Caps','Caps',left+.006,-.367,.029,mat='Key_Grey',small=True)
    keycap('Key_Shift','Shift',left+.010,-.388,.036,mat='Key_Grey',small=True)
    keycap('Key_Return','Enter',.044,-.364,.029,.034,mat='Key_Grey',small=True)
    keycap('Key_ShiftR','Shift',.024,-.388,.052,mat='Key_Grey',small=True)
    for x,label in [(-.196,'Ctrl'),(-.155,'Alt'),(.021,'Alt'),(.053,'Ctrl')]:keycap('Key_'+label+'_Bottom',label,x,-.413,.026,mat='Key_Grey',small=True)
    keycap('Key_Space','',-.068,-.413,.126)
    for j,labels in enumerate([['Ins','Home','PgUp'],['Del','End','PgDn']]):
        for i,label in enumerate(labels):keycap('Key_'+label,label,.084+i*.018,-.327-j*.021,small=True)
    for x,y,label in [(.102,-.388,'^'),(.084,-.410,'<'),(.102,-.410,'v'),(.120,-.410,'>')]:keycap('Arrow_'+label,label,x,y,mat='Key_Grey')
    for j,labels in enumerate([['Num','/','*','-'],['7','8','9','+'],['4','5','6',''],['1','2','3','Enter'],['0','.','','']]):
        for i,label in enumerate(labels):
            if label:keycap('Num_'+label,label,.15+i*.018,-.326-j*.021,mat='Key_Cream',small=len(label)>1)
    for i in range(3):box('Keyboard_LED_%d'%i,(.159+i*.017,-.292,.799),(.003,.006,.001),'Green_LED',.0003,'Keyboard')
    cable('Keyboard_Cable',[(-.18,-.284,.79),(-.31,-.19,.77),(-.32,.18,.768),(-.12,.28,.80)],.0027)
    # Mouse with rounded shell, button split and dark cloth mat.
    box('Mouse_Mat',(.337,-.345,.752),(.173,.20,.003),'Key_Grey',.006,'Props')
    box('Mouse_Lower',(.329,-.352,.765),(.056,.094,.022),'ABS_Shadow',.016,'Props')
    box('Mouse_Shell',(.329,-.346,.780),(.057,.087,.025),'ABS_Ivory',.018,'Props')
    for x in [.314,.344]:box('Mouse_Button',(x,-.321,.791),(.027,.040,.011),'ABS_Ivory',.007,'Props')
    cable('Mouse_Cable',[(.329,-.30,.78),(.40,-.2,.756),(.33,.30,.76),(.075,.275,.828)],.0018)

def stage_disk():
    disk=empty('Floppy_Disk',cname='Interactive')
    box('Floppy_Plastic',(0,0,0),(.090,.094,.0033),'Disk_Blue',.0014,'Interactive',disk)
    box('Floppy_Seam',(0,0,-.0014),(.088,.092,.0008),'Black',.0008,'Interactive',disk)
    box('Floppy_Metal_Shutter',(0,.029,.002),(.062,.030,.0007),'Steel',.001,'Interactive',disk)
    box('Floppy_Shutter_Aperture',(.016,.029,.00245),(.012,.021,.0003),'Black',.0004,'Interactive',disk)
    box('Floppy_Shutter_Tongue',(.017,.029,.0027),(.008,.018,.0003),'Steel',.0004,'Interactive',disk)
    box('Floppy_Label',(0,-.013,.00194),(.073,.049,.0002),'Paper',.001,'Interactive',disk)
    box('Floppy_Label_Stripe',(0,.006,.00210),(.071,.006,.0001),'Red_Book',.0001,'Interactive',disk)
    text_obj('Disk_Title','STAR COURIER',(-.032,-.008,.0022),.006,'Ink',rotation=(0,0,0),cname='Interactive',parent=disk)
    text_obj('Disk_Note','A:  >  DIR  >  STAR',(-.031,-.020,.0022),.0038,'Ink',rotation=(0,0,0),cname='Interactive',parent=disk)
    text_obj('Disk_Size','1.44 MB    /    1994',(-.031,-.031,.0022),.0032,'Ink',rotation=(0,0,0),cname='Interactive',parent=disk)
    for x in [-.038,.038]:box('Floppy_corner_inset',(x,-.039,.0018),(.004,.005,.0002),'Black',.0003,'Interactive',disk)
    cylinder('Floppy_Hub',(0,.003,-.002),.012,.0006,'Steel','Interactive',parent=disk)
    disk.location=(.45,-.175,.757);disk.rotation_euler.z=math.radians(-16)
    empty('Floppy_Insert_Target',(.137,-.149,.854),cname='Interactive')

def stage_props():
    # Green enamel task lamp; articulated arm and open shade.
    cylinder('Lamp_Base',(.595,.18,.764),.079,.027,'Lamp_Green','Props')
    cylinder('Lamp_Base_Ring',(.595,.18,.753),.072,.006,'Brass','Props')
    cable('Lamp_Lower_Arm',[(.595,.18,.777),(.612,.19,1.0),(.575,.16,1.105)],.012,'Lamp_Green','Props')
    cable('Lamp_Upper_Arm',[(.575,.16,1.105),(.57,.095,1.23),(.515,.06,1.265)],.009,'Lamp_Green','Props')
    cylinder('Lamp_Hinge',(.574,.158,1.103),.023,.032,'Brass','Props',rotation=(0,math.pi/2,0))
    # Open shade, faces as concentric rings in XY, separate interior.
    def shade(name,mat,rings):
        vs=[];fs=[];n=64
        for radius,z in rings:
            for i in range(n):
                a=i*2*math.pi/n;vs.append((.515+radius*math.cos(a),.06+radius*math.sin(a),z))
        for j in range(len(rings)-1):
            for i in range(n):fs.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
        me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();me.materials.append(M[mat])
        ob=bpy.data.objects.new(name,me);collection('Props').objects.link(ob)
        for p in me.polygons:p.use_smooth=True
    shade('Lamp_Shade','Lamp_Green',[(.028,1.292),(.06,1.27),(.112,1.193),(.113,1.184)])
    shade('Lamp_Interior','Key_Cream',[(.109,1.184),(.107,1.193),(.057,1.266),(.025,1.288)])
    cylinder('DeskLamp_Bulb',(.515,.06,1.235),.016,.055,'Light_Warm','Interactive')
    box('Lamp_Switch',(.60,.136,.780),(.012,.018,.006),'Black',.002,'Interactive')
    cable('Lamp_Cord',[(.65,.22,.77),(.70,.39,.755),(.82,.4,.68),(.86,.37,.07)],.0022,'Cable','Props')
    # Books, paper edges, embossed title.
    for z,w,d,mat,title in [(.768,.16,.22,'Blue_Book','MS-DOS'),(.797,.145,.205,'Red_Book','USER GUIDE')]:
        x=-.49;y=.17
        box('Book_Pages',(x,y,z+.009),(w-.004,d-.006,.021),'Paper',.001,'Props')
        for zz in [z-.004,z+.023]:box('Book_Cover',(x,y,zz),(w+.004,d+.004,.004),mat,.001,'Props')
        box('Book_Spine',(x-w/2,y,z+.008),(.007,d,.027),mat,.001,'Props')
        text_obj('Book_Title',title,(x,y+.035,z+.0255),.017,'Paper',rotation=(0,0,0),cname='Props',align='CENTER')
        text_obj('Book_Subtitle','A practical introduction',(x,y-.018,z+.0255),.0048,'Paper',rotation=(0,0,0),cname='Props',align='CENTER')
    # Disk library at left.
    box('Disk_Box',(-.52,-.115,.79),(.126,.13,.074),'ABS_Shadow',.004,'Props')
    box('Disk_Box_Interior',(-.52,-.115,.829),(.116,.118,.008),'Black',.002,'Props')
    for i in range(5):
        ob=box('Library_Disk_%d'%i,(-.52,-.155+i*.018,.85),(.092,.004,.09),'Disk_Blue' if i%2 else 'ABS_Ivory',.001,'Props')
        ob.rotation_euler.x=math.radians(8)
        box('Library_Label_%d'%i,(-.52,-.158+i*.018,.865),(.072,.001,.033),'Paper',.001,'Props')
    # Open handwritten command card, lies flat for a plausible close-up.
    box('Command_Note',(-.45,-.365,.753),(.17,.12,.0006),'Paper',.001,'Props')
    for y in [-.338,-.36,-.382,-.404]:box('Note_Line',(-.45,y,.7535),(.15,.0004,.0001),'ABS_Shadow',0,'Props')
    text_obj('Note_Heading','TO PLAY THE DISK',(-.521,-.33,.754),.008,'Ink',rotation=(0,0,0),cname='Props')
    text_obj('Note_Command','A:   /   DIR   /   STAR',(-.521,-.355,.754),.007,'Ink',rotation=(0,0,0),cname='Props')
    text_obj('Note_Friend','Can you beat my score?',(-.521,-.378,.754),.006,'Ink',rotation=(0,0,0),cname='Props')
    text_obj('Note_Sign','-  SUMMER 1994',(-.521,-.398,.754),.005,'Ink',rotation=(0,0,0),cname='Props')
    # Ceramic mug with an actual open rim and handle.
    material('Mug',(.53,.59,.54),.23)
    cylinder('Mug_Body',(-.64,.355,.802),.037,.094,'Mug','Props')
    cylinder('Mug_Interior',(-.64,.355,.850),.031,.001,'Black','Props')
    bpy.ops.mesh.primitive_torus_add(major_radius=.034,minor_radius=.003,major_segments=48,minor_segments=12,location=(-.64,.355,.848))
    finish(bpy.context.object,'Mug_Rim','Mug','Props')
    bpy.ops.mesh.primitive_torus_add(major_radius=.026,minor_radius=.006,major_segments=40,minor_segments=10,location=(-.683,.355,.80),rotation=(math.pi/2,0,0))
    finish(bpy.context.object,'Mug_Handle','Mug','Props')
    # Period calendar hangs behind the computer, with simple printed grid.
    box('Calendar_Back',(-.55,.702,1.43),(.25,.013,.32),'Paper',.003,'Props')
    box('Calendar_Header',(-.55,.693,1.547),(.25,.006,.08),'Red_Book',.001,'Props')
    text_obj('Calendar_Year','1994',(-.648,.688,1.55),.043,'Paper',cname='Props')
    text_obj('Calendar_Month','JULY / SUMMER',(-.648,.688,1.515),.009,'Paper',cname='Props')
    for j in range(5):
        for i in range(7):
            v=j*7+i+1
            if v<=31:text_obj('Calendar_day_%02d'%v,str(v),(-.65+i*.030,.692,1.465-j*.034),.012,'Ink',cname='Props',align='CENTER')

def apply_textures():
    load_materials()
    tex=ASSETS/'textures'
    if not (tex/'dark_wood_diff_2k.jpg').exists():return
    # Keep repeat calls bounded: replace generated texture nodes, not append another graph.
    for name in ['Wood', 'ABS_Ivory', 'Key_Cream']:
        nt=M[name].node_tree
        for node in list(nt.nodes):
            if node.type not in {'BSDF_PRINCIPLED', 'OUTPUT_MATERIAL'}:
                nt.nodes.remove(node)
    mat=M['Wood'];nt=mat.node_tree;bs=nt.nodes.get('Principled BSDF')
    coord=nt.nodes.new('ShaderNodeTexCoord');mapping=nt.nodes.new('ShaderNodeVectorMath');mapping.operation='SCALE';mapping.inputs[3].default_value=.5
    # Object coords are actual metres because model scales have been applied.
    nt.links.new(coord.outputs['Object'],mapping.inputs[0])
    for file,target,noncolor in [('dark_wood_diff_2k.jpg','Base Color',False),('dark_wood_rough_2k.jpg','Roughness',True)]:
        t=nt.nodes.new('ShaderNodeTexImage');t.image=bpy.data.images.load(str(tex/file),check_existing=True);t.projection='BOX';t.projection_blend=.15
        if noncolor:t.image.colorspace_settings.name='Non-Color'
        nt.links.new(mapping.outputs[0],t.inputs['Vector'])
        if target=='Roughness':
            mul=nt.nodes.new('ShaderNodeMath');mul.operation='MULTIPLY';mul.inputs[1].default_value=.7
            nt.links.new(t.outputs['Color'],mul.inputs[0]);nt.links.new(mul.outputs[0],bs.inputs[target])
        else:nt.links.new(t.outputs['Color'],bs.inputs[target])
    # Subtle surface grain only, glTF uses material values plus web-added maps.
    noise=nt.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=220
    bump=nt.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.10;bump.inputs['Distance'].default_value=.0002
    nt.links.new(coord.outputs['Object'],noise.inputs['Vector']);nt.links.new(noise.outputs['Fac'],bump.inputs['Height']);nt.links.new(bump.outputs['Normal'],bs.inputs['Normal'])
    for name in ['ABS_Ivory','Key_Cream']:
        nt=M[name].node_tree;bs=nt.nodes.get('Principled BSDF')
        noise=nt.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=950
        bump=nt.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.085;bump.inputs['Distance'].default_value=.000035
        nt.links.new(noise.outputs['Fac'],bump.inputs['Height']);nt.links.new(bump.outputs['Normal'],bs.inputs['Normal'])

def stage2():
    if SCENE not in bpy.data.scenes:
        raise RuntimeError('Run stage1() before stage2().')
    bpy.context.window.scene=bpy.data.scenes[SCENE]
    # A second detail pass replaces its own parts, preserving the room and computer shell.
    detail_collections={'Keyboard', 'Interactive', 'Props'}
    detail_hardware={'Keyboard_Base', 'Keyboard_Keybed', 'Keyboard_Cable', 'Mouse_Cable'}
    remove_generated_objects([
        obj for obj in bpy.context.scene.objects
        if obj.name.split('.')[0] in detail_hardware
        or any(c.name in detail_collections for c in obj.users_collection)
    ])
    load_materials();stage_keyboard();stage_disk();stage_props();apply_textures()
    bpy.context.view_layer.update()
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blender/1994-desk.blend'))

if __name__=='__main__':
    stage1()
    stage2()
