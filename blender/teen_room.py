"""Original rock-room set dressing. Loaded by build_scene.py into its authoring namespace."""

def stage_teen_room():
    material('Poster_Cream',(.68,.59,.38),.9)
    material('Poster_Red',(.39,.025,.018),.88)
    material('Poster_Cyan',(.08,.25,.28),.88)
    material('Poster_Pink',(.39,.095,.18),.9)
    material('Tape',(.39,.32,.18),.94)
    material('Denim',(.025,.063,.13),.95)
    material('Pillow',(.39,.38,.33),.95)
    material('Cork',(.22,.125,.055),.98)
    material('Speaker_Cloth',(.022,.024,.026),.97)
    material('Lava_Red',(.95,.042,.005),.2,0,1.1)
    material('Lava_Yellow',(1,.34,.016),.25,0,2.8)
    glass=material('Lava_Glass',(.55,.21,.055),.14)
    glass.node_tree.nodes['Principled BSDF'].inputs['Transmission Weight'].default_value=.72
    material('Shelf_Blue',(.08,.26,1),.3,0,2)

    def sphere(name,loc,scale,mat,segments=32):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=20,location=loc)
        o=bpy.context.object;o.scale=scale
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        for p in o.data.polygons:p.use_smooth=True
        return finish(o,name,mat,'Props')

    def lathe(name,x,y,rings,mat):
        n=48;vs=[];fs=[]
        for z,r in rings:
            for i in range(n):
                a=i*2*math.pi/n;vs.append((x+r*math.cos(a),y+r*math.sin(a),z))
        for j in range(len(rings)-1):
            for i in range(n):fs.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
        fs.extend([tuple(reversed(range(n))),tuple((len(rings)-1)*n+i for i in range(n))])
        me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update()
        o=bpy.data.objects.new(name,me);collection('Props').objects.link(o);me.materials.append(M[mat])
        for p in me.polygons:p.use_smooth=True
        return o

    def poster(name,x,z,w,h,bg):
        box(name,(x,.702,z),(w,.0015,h),bg,.0004,'Props')
        for dx,dz,ang in [(-w*.37,h*.46,-18),(w*.37,h*.46,13),(-w*.37,-h*.46,9),(w*.37,-h*.46,-11)]:
            o=box(name+'_tape',(x+dx,.700,z+dz),(.051,.001,.024),'Tape',.0003,'Props')
            o.rotation_euler.y=math.radians(ang)

    # Fictional bands and local gigs: authored geometry, no copied stock-image pixels.
    poster('Poster_StaticYouth',-.53,1.66,.43,.62,'Poster_Cream')
    text_obj('Static_Heading','STATIC',(-.715,.698,1.85),.069,'Black',cname='Props')
    text_obj('Youth_Heading','YOUTH',(-.715,.698,1.785),.071,'Poster_Red',cname='Props')
    text_obj('Static_Footer','LOUDER THAN YOUR TV',(-.71,.698,1.40),.019,'Black',cname='Props')
    text_obj('Static_Gig','FRIDAY JULY 22  /  ALL AGES',(-.71,.698,1.373),.012,'Black',cname='Props')
    # Cut-paper guitar silhouette, oriented diagonally across the printed poster.
    for x,z,r in [(-.57,1.52,.061),(-.58,1.585,.046)]:
        cylinder('Poster_Guitar_Body',(x,.697,z),r,.001,'Poster_Red','Props',rotation=(math.pi/2,0,0),vertices=32)
    neck=box('Poster_Guitar_Neck',(-.526,.696,1.654),(.022,.001,.21),'Black',0,'Props');neck.rotation_euler.y=.34
    text_obj('Static_X','X',(-.692,.696,1.555),.12,'Black',cname='Props')
    for i in range(4):box('Poster_Print_Line',(-.391,.696,1.72-i*.04),(.091,.001,.007),'Black',0,'Props')

    # Original generated xerox print, kept as an editable image material in Blender.
    poster_path=ROOT/'public/assets/posters/static-youth.png'
    if poster_path.is_file():
        prefixes=('Static_Heading','Youth_Heading','Static_Footer','Static_Gig','Poster_Guitar_','Static_X','Poster_Print_Line')
        for o in list(collection('Props').objects):
            if o.name.startswith(prefixes):bpy.data.objects.remove(o,do_unlink=True)
        printmat=material('Poster_Print_Static',(.8,.75,.65),.94)
        tex=printmat.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image=bpy.data.images.load(str(poster_path),check_existing=True)
        printmat.node_tree.links.new(tex.outputs['Color'],printmat.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
        mesh=bpy.data.meshes.new('StaticYouth_Print')
        mesh.from_pydata([(-.745,.7008,1.35),(-.315,.7008,1.35),(-.315,.7008,1.97),(-.745,.7008,1.97)],[],[(0,1,2,3)])
        mesh.update();uv=mesh.uv_layers.new(name='UVMap')
        for i,coord in enumerate([(0,0),(1,0),(1,1),(0,1)]):uv.data[i].uv=coord
        obj=bpy.data.objects.new('StaticYouth_Print',mesh);collection('Props').objects.link(obj);mesh.materials.append(printmat)

    poster('Poster_AfterHours',.26,1.81,.43,.55,'Black')
    text_obj('Hours_Title','AFTER',(.075,.698,1.984),.067,'Poster_Cyan',cname='Props')
    text_obj('Hours_Title2','HOURS',(.075,.698,1.921),.067,'Poster_Cream',cname='Props')
    # Radiating circles and a red horizon evoke a photocopied psychedelic gig flyer.
    for i in range(5):
        bpy.ops.mesh.primitive_torus_add(major_radius=.055+i*.014,minor_radius=.0018,major_segments=48,minor_segments=6,location=(.285,.696,1.762),rotation=(math.pi/2,0,0))
        finish(bpy.context.object,'Poster_Rings','Poster_Cyan' if i%2 else 'Poster_Pink','Props')
    box('Poster_Horizon',(.26,.693,1.657),(.38,.001,.041),'Poster_Red',0,'Props')
    text_obj('Hours_Footer','GARAGE TAPES VOL. 2',(.079,.691,1.59),.016,'Poster_Cream',cname='Props')
    text_obj('Hours_Year','SUMMER / 1994',(.079,.691,1.558),.011,'Poster_Pink',cname='Props')

    # Skateboard mounted to the back wall, with trucks and urethane wheels.
    loft('Wall_Skateboard',[(.658,.157,.53,.071,1.69),(.645,.16,.535,.074,1.69)],'Poster_Red','Props',cap=True).location.x=-1.064
    for z in [1.51,1.87]:
        box('Skate_Truck',(-1.064,.615,z),(.123,.035,.015),'Steel',.003,'Props')
        for x in [-1.144,-.984]:cylinder('Skate_Wheel',(x,.615,z),.026,.025,'Poster_Cream','Props',rotation=(0,math.pi/2,0),vertices=32)
    text_obj('Skate_Label','NO',(-1.111,.634,1.743),.052,'Poster_Cream',cname='Props')
    text_obj('Skate_Label','RULES',(-1.126,.634,1.69),.034,'Black',cname='Props')

    # Low bedside cabinet and an illuminated lava lamp.
    box('Side_Cabinet',(-1.015,.27,.325),(.36,.40,.62),'ABS_Shadow',.006,'Props')
    box('Side_Cabinet_Top',(-1.015,.27,.644),(.384,.424,.027),'Wood_Edge',.005,'Props')
    for z in [.17,.44]:
        box('Cabinet_Drawer',(-1.015,.061,z),(.336,.016,.235),'Key_Grey',.003,'Props')
        box('Cabinet_Pull',(-1.015,.045,z+.055),(.067,.014,.008),'Steel',.002,'Props')
    lathe('Lava_Base',-1.015,.28,[(.658,.066),(.674,.065),(.725,.030),(.748,.046)],'Steel')
    lathe('Lava_Glass',-1.015,.28,[(.743,.045),(.80,.047),(.984,.023),(1.022,.022)],'Lava_Glass')
    lathe('Lava_Cap',-1.015,.28,[(1.021,.023),(1.08,.014),(1.086,.014)],'Steel')
    lathe('Lava_Core',-1.015,.28,[(.748,.038),(.788,.04),(.98,.013)],'Lava_Red')
    for i,(dx,dy,z,sx,sy,sz) in enumerate([(-.013,-.024,.785,.022,.014,.027),(.012,-.024,.846,.019,.013,.037),(-.004,-.015,.917,.014,.012,.024),(.004,-.011,.979,.008,.008,.012)]):
        sphere('Lava_Blob_%d'%i,(-1.015+dx,.28+dy,z),(sx,sy,sz),'Lava_Yellow')
    cable('Lava_Cord',[(-1.015,.34,.672),(-1.05,.45,.62),(-1.1,.53,.09),(-.8,.70,.07)],.0018,'Cable','Props')

    # Bed at the edge of the field of view keeps this a bedroom, with a folded denim cover.
    box('Bed_Frame',(-1.425,-.98,.205),(.72,1.61,.18),'Wood_Edge',.025,'Props')
    box('Mattress',(-1.425,-.98,.335),(.70,1.58,.19),'Pillow',.055,'Props')
    box('Denim_Duvet',(-1.425,-1.09,.437),(.704,1.34,.085),'Denim',.052,'Props')
    box('Duvet_Fold',(-1.425,-.54,.474),(.706,.21,.043),'Blue_Book',.019,'Props')
    sphere('Bed_Pillow',(-1.425,-.34,.466),(.29,.16,.077),'Pillow')
    for i in range(5):
        cable('Duvet_Seam',[(-1.70+i*.13,-1.69,.466),(-1.71+i*.13,-1.1,.483),(-1.69+i*.13,-.68,.476)],.0012,'Blue_Book','Props')

    # Open bookcase with stereo, paperbacks and a weak indoor blue accent strip.
    for x in [.90,1.42]:box('Bookcase_Side',(x,.47,.815),(.025,.39,1.63),'Wood_Edge',.002,'Props')
    box('Bookcase_Back',(1.16,.667,.815),(.52,.012,1.61),'Wood_Edge',.001,'Props')
    for z in [.06,.38,.78,1.14,1.63]:box('Bookcase_Shelf',(1.16,.47,z),(.52,.39,.024),'Wood_Edge',.003,'Props')
    box('Shelf_LED',(1.16,.288,1.119),(.39,.006,.006),'Shelf_Blue',.001,'Props')
    for i,(h,mat) in enumerate([(.29,'Poster_Cream'),(.32,'Black'),(.28,'Red_Book'),(.34,'Blue_Book'),(.30,'Paper'),(.26,'Black'),(.33,'Poster_Cream'),(.29,'Poster_Red')]):
        x=.946+i*.055
        box('Shelf_Book',(x,.47,1.165+h/2),(.037,.255,h),mat,.0015,'Props')
        box('Shelf_Book_Pages',(x,.471,1.17+h/2),(.032,.24,h-.016),'Paper',.0003,'Props')
        box('Shelf_Book_Spine',(x,.338,1.165+h/2),(.039,.008,h),mat,.001,'Props')
        ob=text_obj('Book_Spine_Type',['GUITAR','SKATE','ZINE','SCI-FI','NOISE','RADIO','STARS','RIOT'][i],(x+.009,.332,1.185),.013,'Paper' if mat in ['Black','Red_Book','Blue_Book','Poster_Red'] else 'Ink',cname='Props')
        ob.rotation_euler.y=-math.pi/2
    # Compact cassette boombox with separate round speaker cones.
    box('Stereo_Body',(1.16,.44,.58),(.44,.27,.25),'Key_Grey',.013,'Props')
    box('Stereo_Front',(1.16,.299,.58),(.421,.013,.22),'ABS_Shadow',.009,'Props')
    for x in [1.023,1.297]:
        cylinder('Speaker_Ring',(x,.288,.57),.078,.012,'Steel','Props',rotation=(math.pi/2,0,0))
        cylinder('Speaker_Cloth',(x,.280,.57),.07,.013,'Speaker_Cloth','Props',rotation=(math.pi/2,0,0))
        cylinder('Speaker_Cone',(x,.271,.57),.027,.008,'Black','Props',rotation=(math.pi/2,0,0))
    box('Cassette_Door',(1.16,.286,.565),(.095,.01,.093),'Black',.003,'Props')
    box('Cassette_Window',(1.16,.279,.58),(.073,.002,.032),'Blue_Book',.001,'Props')
    for i in range(5):box('Stereo_Button',(1.12+i*.02,.284,.658),(.013,.009,.009),'Steel',.001,'Props')
    cable('Stereo_Handle',[(.994,.45,.70),(.994,.45,.758),(1.326,.45,.758),(1.326,.45,.70)],.007,'Black','Props')
    for i in range(7):
        box('Cassette_Case',(.979+i*.056,.43,.858),(.049,.145,.13),'Black' if i%3 else 'Red_Book',.002,'Props')
        box('Cassette_Spine',(.979+i*.056,.354,.858),(.042,.002,.117),'Paper',.0002,'Props')
    # The CRT top is z=1.283-0.10*y here. Rest the cases on that plane and on one another.
    mix_pitch=math.atan(-.1);mix_cos=math.cos(mix_pitch);mix_sin=math.sin(mix_pitch)
    def mixtape_point(x,y,z):return (x,.005+mix_cos*y-mix_sin*z,1.2825+mix_sin*y+mix_cos*z)
    for i in range(3):
        z=(i+.5)*.015-.0002
        case=box('Monitor_Mixtape',mixtape_point(-.04,0,z),(.118,.079,.015),'Black' if i%2 else 'ABS_Shadow',.002,'Props')
        case.rotation_euler.x=mix_pitch
        sticker=box('Mixtape_Sticker',mixtape_point(-.04,-.040,z),(.102,.001,.010),'Paper',.0002,'Props')
        sticker.rotation_euler.x=mix_pitch
    text_obj('Mix_Label','SUMMER MIX / J.',mixtape_point(-.086,-.0408,.0057),.0055,'Ink',rotation=(math.pi/2+mix_pitch,0,0),cname='Props')

    # Pins, tickets and a lopsided flyer above the bookcase.
    box('Corkboard_Frame',(.977,.697,1.954),(.54,.023,.42),'Wood_Edge',.004,'Props')
    box('Corkboard_Surface',(.977,.681,1.954),(.514,.007,.394),'Cork',.001,'Props')
    for i,(x,z,mat) in enumerate([(.80,2.035,'Paper'),(.99,1.91,'Poster_Cream'),(1.14,2.018,'Poster_Pink')]):
        o=box('Pinned_Flyer',(x,.675,z),(.127,.001,.18),mat,.0003,'Props');o.rotation_euler.y=(-1 if i%2 else 1)*.09
        cylinder('Push_Pin',(x,.668,z+.075),.004,.007,'Poster_Red','Props',rotation=(math.pi/2,0,0),vertices=16)
        text_obj('Flyer_Type',['BAND','JUL 22','HEY!'][i],(x-.047,.668,z+.024),.019,'Black',cname='Props')
        text_obj('Flyer_Subtype',['PRACTICE','BASEMENT','CALL ME'][i],(x-.047,.668,z-.008),.009,'Ink',cname='Props')

    # Headphones beside the mouse, with a real curved band and a loose cable.
    for x in [.60,.738]:
        box('Headphone_Earcup',(x,-.346,.769),(.046,.071,.035),'Black',.012,'Props')
        box('Headphone_Cushion',(x,-.346,.755),(.042,.063,.014),'Speaker_Cloth',.008,'Props')
    cable('Headphone_Band',[(.60,-.318,.779),(.592,-.239,.78),(.669,-.214,.78),(.745,-.239,.78),(.738,-.318,.779)],.007,'Black','Props')
    cable('Headphone_Cord',[(.605,-.381,.768),(.53,-.437,.756),(.44,-.423,.755),(.50,-.32,.755),(.46,-.27,.755)],.0012,'Cable','Props')
