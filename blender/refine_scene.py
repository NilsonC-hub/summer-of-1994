import bpy, bmesh, math, os
from pathlib import Path
ROOT=Path(os.environ.get('I486_ROOT', 'E:/i486'))
ns={'__name__':'builder'}
exec(compile((ROOT/'blender/build_scene.py').read_text(encoding='utf-8'),'build_scene.py','exec'),ns)
scene=bpy.data.scenes.get(ns['SCENE'])
if scene is None or 'Screen_Surface' not in scene.objects:
    raise RuntimeError('Open blender/1994-desk.blend or run both build stages before refining.')
bpy.context.window.scene=scene
bezel=scene.objects['Monitor_Bezel']
rings=[(-.16,.352,.316,.012,1.137),(-.204,.352,.316,.012,1.137),(-.219,.346,.310,.011,1.137),(-.219,.280,.214,.011,1.155),(-.213,.270,.204,.008,1.155)]
coords=[]
for y,w,h,r,zc in rings:coords.extend((x,y,z) for x,z in ns['rounded_loop'](w,h,r,zc))
for vert,co in zip(bezel.data.vertices,coords):vert.co=co
for i,p in enumerate(bezel.data.polygons):p.use_smooth=not (64<=i<96)
bezel.data.update()
screen=scene.objects['Screen_Surface']
screen_material=screen.data.materials[0]
old_screen_mesh=screen.data
screen.data=ns['rounded_screen_mesh']()
screen.data.materials.append(screen_material)
if old_screen_mesh.users==0:
    bpy.data.meshes.remove(old_screen_mesh)
for obj in bpy.context.scene.objects:
    if obj.type!='MESH':continue
    bm=bmesh.new();bm.from_mesh(obj.data)
    if all(len(e.link_faces)==2 for e in bm.edges):
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data)
    elif obj.name=='Lamp_Shade' and not obj.get('normal_fixed'):
        bmesh.ops.reverse_faces(bm,faces=list(bm.faces));bm.to_mesh(obj.data);obj['normal_fixed']=True
    bm.free()
# Reflection from the model should reveal form, not turn the green shade white.
mat=bpy.data.materials['Lamp_Green'];bs=mat.node_tree.nodes.get('Principled BSDF')
bs.inputs['Roughness'].default_value=.46
bs.inputs['Metallic'].default_value=.0
bs.inputs['Specular IOR Level'].default_value=.25
bpy.data.materials['ABS_Ivory'].node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.58
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blender/1994-desk.blend'))
exec(compile((ROOT/'blender/export_scene.py').read_text(encoding='utf-8'),'export_scene.py','exec'))
