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
    material('Wall',(.055,.095,.13),.95)
    material('Trim',(.73,.71,.60),.52)
    material('Floor',(.14,.115,.10),.93)
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
    world=bpy.data.worlds.get('Night interior') or bpy.data.worlds.new('Night interior');world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.09,.14,.22,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.08;scene.world=world

def stage_room():
    # Desk top and original joinery.
    box('Desk_Top',(0,0,.724),(1.65,.95,.052),'Wood',.012,'Room')
    box('Desk_Front_Edge',(0,-.470,.709),(1.62,.019,.04),'Wood_Edge',.006,'Room')
    for x in [-.72,.72]:
        for y in [-.34,.34]:box('Desk_Leg',(x,y,.355),(.065,.065,.71),'Wood_Edge',.004,'Room')
    box('Drawer_Cabinet',(-.565,.02,.595),(.34,.68,.20),'Wood',.007,'Room')
    box('Drawer_Front',(-.565,-.337,.600),(.327,.017,.173),'Wood_Edge',.004,'Room')
    box('Drawer_Handle',(-.565,-.352,.63),(.102,.014,.012),'Brass',.004,'Room')
    box('Back_Wall',(-.15,.76,1.20),(3.50,.09,2.6),'Wall',.003,'Room')
    box('Right_Wall',(1.57,-.68,1.2),(.09,2.8,2.6),'Wall',.003,'Room')
    box('Left_Wall',(-1.87,-.68,1.2),(.09,2.8,2.6),'Wall',.003,'Room')
    box('Room_Floor',(-.15,-.65,-.035),(3.5,3.0,.07),'Floor',.002,'Room')
    box('Skirting_Back',(-.15,.699,.055),(3.4,.035,.11),'Wood_Edge',.002,'Room')
    for x in [-1.82,1.52]:box('Skirting_Side',(x,-.68,.055),(.035,2.78,.11),'Wood_Edge',.002,'Room')

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
        # Follow the shell's -0.10 Z/Y slope and stay inside its flat top shoulder.
        vent=box('CRT_Top_Vent_%02d'%i,(-.084+i*.012,.05,1.27825),(.005,.080,.0008),'ABS_Shadow',.0002)
        vent.rotation_euler.x=math.atan(-.1)
    cable('Monitor_Cable',[(.03,.195,1.075),(.06,.32,.91),(.15,.32,.805),(.14,.26,.81)],.004)

def camera_light():
    scene=bpy.context.scene
    def area(name,loc,energy,color,size,target):
        d=bpy.data.lights.new(name,'AREA');d.energy=energy;d.color=color;d.shape='DISK';d.size=size
        o=bpy.data.objects.new(name,d);collection('Lighting').objects.link(o);o.location=loc
        o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();return o
    area('Ceiling_bounce',(-.5,-.6,2.25),19,(1,.77,.48),1.6,(0,0,.85))
    area('Warm_lamp_pool',(.515,.02,1.23),13,(1,.62,.27),.16,(.24,-.15,.76))
    area('Interior_fill',(.45,-1.1,1.65),7,(.64,.76,1),1.4,(0,0,1))
    area('Lava_wall_glow',(-1.00,.30,.99),9,(1,.15,.025),.22,(-.8,.72,1.1))
    area('Shelf_accent',(.97,.5,1.55),5,(.23,.48,1),.38,(.8,.1,1.1))
    d=bpy.data.cameras.new('Seated first person');o=bpy.data.objects.new('Camera_Overview',d)
    collection('Lighting').objects.link(o);o.location=(.939,-2.258,1.506)
    o.rotation_euler=(Vector((.01,.04,1.18))-o.location).to_track_quat('-Z','Y').to_euler()
    d.lens=38;scene.camera=o
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
    # A single sloping deck supports every row, including the raised function row.
    # Cap skirts extend 1.7 mm into it; there is no exposed air gap beneath a key.
    slope=.07
    def deck_z(y):return .784+slope*(y+.365)
    base=box('Keyboard_Base',(0,-.365,.769),(.444,.168,.026),'ABS_Ivory',.005)
    for v in base.data.vertices:
        if v.co.z>0:v.co.z=deck_z(base.location.y+v.co.y)-base.location.z
    for x in [-.181,.181]:
        for y in [-.414,-.315]:box('Keyboard_Rubber_Foot',(x,y,.753),(.032,.019,.006),'Cable',.001,'Keyboard')
    bed=box('Keyboard_Keybed',(0,-.361,.7826),(.421,.146,.004),'ABS_Shadow',.001)
    for v in bed.data.vertices:v.co.z+=slope*(bed.location.y+v.co.y+.365)
    # ANSI 101-key spacing, without the later Windows/menu keys.
    unit=.018;gap=.0025;left=-.209;row_y=[-.326-i*.0215 for i in range(5)]
    def keycap(name,label,x,y,w=unit-gap,h=.0185,mat='Key_Cream',small=False):
        sizes=[(w,h,-.0017),(w,h,.004),(w-.0028,h-.0028,.009)]
        vs=[]
        for sw,sh,dz in sizes:
            for dx,dy in [(-sw/2,-sh/2),(sw/2,-sh/2),(sw/2,sh/2),(-sw/2,sh/2)]:
                vs.append((x+dx,y+dy,deck_z(y+dy)+dz))
        fs=[(3,2,1,0)]
        for j in range(2):
            for k in range(4):fs.append((j*4+k,j*4+(k+1)%4,(j+1)*4+(k+1)%4,(j+1)*4+k))
        fs.append((8,9,10,11))
        me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update()
        ob=bpy.data.objects.new(name,me);collection('Keyboard').objects.link(ob);me.materials.append(M[mat])
        mod=ob.modifiers.new('Key edge','BEVEL');mod.width=.0006;mod.segments=2
        ob.modifiers.new('Normals','WEIGHTED_NORMAL')
        ly=y-.002
        legend=text_obj(name+'_Legend',label,(x,ly,deck_z(ly)+.0095),.0035 if small else .0055,'Ink',rotation=(math.atan(slope),0,0),cname='Keyboard',align='CENTER')
        if os.path.exists('C:/Windows/Fonts/arialbd.ttf'):
            legend.data.font=bpy.data.fonts.get('Arial Bold') or bpy.data.fonts.load('C:/Windows/Fonts/arialbd.ttf')
    def row(index,keys):
        cursor=0
        for name,label,span,modifier in keys:
            keycap(name,label,left+(cursor+span/2)*unit,row_y[index],span*unit-gap,
                   mat='Key_Grey' if modifier else 'Key_Cream',small=len(label)>1)
            cursor+=span
        assert abs(cursor-15)<1e-8,'The main key rows must be exactly 15 units wide'
    def letters(labels):return [('Key_'+str(ord(label)),label,1,False) for label in labels]
    row(0,letters('`1234567890-=')+[('Key_Backspace','Back',2,True)])
    row(1,[('Key_Tab','Tab',1.5,True)]+letters('QWERTYUIOP[]')+[('Key_Backslash','\\',1.5,False)])
    row(2,[('Key_Caps','Caps',1.75,True)]+letters("ASDFGHJKL;'")+[('Key_Return','Enter',2.25,True)])
    row(3,[('Key_Shift','Shift',2.25,True)]+letters('ZXCVBNM,./')+[('Key_ShiftR','Shift',2.75,True)])
    for start,span,name,label in [(0,1.5,'CtrlL','Ctrl'),(2.5,1.5,'AltL','Alt'),
                                   (4,7,'Space',''),(11,1.5,'AltR','Alt'),(13.5,1.5,'CtrlR','Ctrl')]:
        keycap('Key_'+name,label,left+(start+span/2)*unit,row_y[4],span*unit-gap,
               mat='Key_Cream' if name=='Space' else 'Key_Grey',small=True)
    keycap('Key_Esc','Esc',left+unit/2,-.297,h=.0155,mat='Key_Grey',small=True)
    for group,start in enumerate([2,6.5,11]):
        for i in range(4):
            number=group*4+i+1
            keycap('Key_F%d'%number,'F%d'%number,left+(start+i+.5)*unit,-.297,h=.0155,small=True)
    nav_left=.070
    for i,label in enumerate(['PrtSc','Scroll','Pause']):
        keycap('Key_'+label,label,nav_left+(i+.5)*unit,-.297,h=.0155,small=True)
    for j,labels in enumerate([['Ins','Home','PgUp'],['Del','End','PgDn']]):
        for i,label in enumerate(labels):keycap('Key_'+label,label,nav_left+(i+.5)*unit,row_y[j],small=True)
    for i,j,label in [(1,3,'^'),(0,4,'<'),(1,4,'v'),(2,4,'>')]:
        keycap('Arrow_'+label,label,nav_left+(i+.5)*unit,row_y[j],mat='Key_Grey')
    num_left=.135
    for j,labels in enumerate([['Num','/','*','-'],['7','8','9'],['4','5','6'],['1','2','3']]):
        for i,label in enumerate(labels):keycap('Num_'+label,label,num_left+(i+.5)*unit,row_y[j],small=len(label)>1)
    keycap('Num_0','0',num_left+unit,row_y[4],2*unit-gap)
    keycap('Num_Decimal','.',num_left+2.5*unit,row_y[4])
    for name,label,a,b in [('Plus','+',1,2),('Enter','Enter',3,4)]:
        keycap('Num_'+name,label,num_left+3.5*unit,(row_y[a]+row_y[b])/2,h=.0215+.0185,small=len(label)>1)
    for i in range(3):
        x=.156+i*.019;y=-.297
        led=box('Keyboard_LED_%d'%i,(x,y,deck_z(y)+.0012),(.0028,.005,.001),'Green_LED',.0003,'Keyboard')
        led.rotation_euler.x=math.atan(slope)
    cable('Keyboard_Cable',[(-.18,-.283,.782),(-.31,-.19,.77),(-.32,.18,.768),(-.12,.28,.80)],.0027)
    # A continuous, low two-button ball-mouse shell; button seams follow its dome.
    box('Mouse_Mat',(.337,-.345,.752),(.173,.20,.003),'Key_Grey',.006,'Props')
    mx=.329;my=-.350;rx=.030;ry=.053;seam_z=.760
    for y in [my-.031,my+.031]:box('Mouse_Glide',(mx,y,.754),(.025,.012,.001),'ABS_Shadow',.0004,'Props')
    def mouse_mesh(name,verts,faces,mat):
        me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
        ob=bpy.data.objects.new(name,me);collection('Props').objects.link(ob);me.materials.append(M[mat])
        for p in me.polygons:p.use_smooth=True
        return ob
    verts=[];faces=[];segments=64
    for a,b,z in [(.027,.048,.7545),(.0295,.0525,.7565),(rx,ry,seam_z)]:
        for i in range(segments):
            angle=2*math.pi*i/segments
            verts.append((mx+a*math.cos(angle),my+b*math.sin(angle),z))
    faces.append(tuple(reversed(range(segments))))
    for ring in range(2):
        for i in range(segments):
            j=(i+1)%segments
            faces.append((ring*segments+i,ring*segments+j,(ring+1)*segments+j,(ring+1)*segments+i))
    faces.append(tuple(range(2*segments,3*segments)))
    mouse_mesh('Mouse_Lower',verts,faces,'ABS_Shadow')
    def mouse_patch(name,t0,t1,u0,u1,mat,offset=0):
        vs=[];fs=[];rows=[];ny=32;nx=24
        for j in range(ny+1):
            t=t0+(t1-t0)*j/ny
            if abs(t)>1-1e-9:
                rows.append([len(vs)]);vs.append((mx,my+ry*t,seam_z+offset));continue
            width=rx*math.sqrt(1-t*t)
            height=.028*(1-t*t)**.62*(1-.13*t)
            ids=[]
            for i in range(nx+1):
                u=u0+(u1-u0)*i/nx
                ids.append(len(vs));vs.append((mx+width*u,my+ry*t,seam_z+height*max(0,1-u*u)**.65+offset))
            rows.append(ids)
        for a,b in zip(rows,rows[1:]):
            if len(a)==1:
                fs.extend((a[0],b[i+1],b[i]) for i in range(nx))
            elif len(b)==1:
                fs.extend((a[i],a[i+1],b[0]) for i in range(nx))
            else:
                fs.extend((a[i],a[i+1],b[i+1],b[i]) for i in range(nx))
        return mouse_mesh(name,vs,fs,mat)
    mouse_patch('Mouse_Button_Seam',-1,1,-1,1,'ABS_Shadow',-.00065)
    mouse_patch('Mouse_Shell',-1,.135,-1,1,'ABS_Ivory')
    mouse_patch('Mouse_Button_L',.15,1,-1,-.011,'ABS_Ivory')
    mouse_patch('Mouse_Button_R',.15,1,.011,1,'ABS_Ivory')
    cable('Mouse_Cable',[(mx,my+ry-.001,seam_z+.001),(.332,-.279,.760),(.40,-.2,.756),(.33,.30,.76),(.075,.275,.828)],.0018)

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
    for name,words,x,y,size,angle in [('Note_Heading','yo dude,',-.521,-.327,.010,-3),('Note_Command','A:  >  DIR  >  STAR',-.518,-.354,.007,2),('Note_Friend',"dont trash my high score",-.522,-.378,.006,-2),('Note_Sign','- J.    (bring it back!)',-.493,-.399,.005,3)]:
        ob=text_obj(name,words,(x,y,.754),size,'Ink',rotation=(0,0,math.radians(angle)),cname='Props')
        font='C:/Windows/Fonts/segoepr.ttf'
        if os.path.exists(font):ob.data.font=bpy.data.fonts.load(font,check_existing=True)
    # Ceramic mug with an actual open rim and handle.
    material('Mug',(.53,.59,.54),.23)
    cylinder('Mug_Body',(-.64,.355,.802),.037,.094,'Mug','Props')
    cylinder('Mug_Interior',(-.64,.355,.850),.031,.001,'Black','Props')
    bpy.ops.mesh.primitive_torus_add(major_radius=.034,minor_radius=.003,major_segments=48,minor_segments=12,location=(-.64,.355,.848))
    finish(bpy.context.object,'Mug_Rim','Mug','Props')
    bpy.ops.mesh.primitive_torus_add(major_radius=.026,minor_radius=.006,major_segments=40,minor_segments=10,location=(-.683,.355,.80),rotation=(math.pi/2,0,0))
    finish(bpy.context.object,'Mug_Handle','Mug','Props')
    stage_teen_room()

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

exec(compile((ROOT/'blender/teen_room.py').read_text(encoding='utf-8'),'teen_room.py','exec'))

if __name__=='__main__':
    stage1()
    stage2()
