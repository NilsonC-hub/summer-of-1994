"""Export evaluated meshes; restore the editable scene even when export fails."""
import bpy, bmesh, json, os
from pathlib import Path

ROOT=Path(os.environ.get('I486_ROOT', 'E:/i486'))
SCENE='1994 - The borrowed disk'


def export_desk():
    source=bpy.data.scenes.get(SCENE)
    if source is None or 'Screen_Surface' not in source.objects:
        raise RuntimeError('Open blender/1994-desk.blend or build the complete scene before export.')
    window=bpy.context.window
    previous_scene=window.scene
    window.scene=source
    deps=bpy.context.evaluated_depsgraph_get()
    staging=bpy.data.scenes.new('GLB export staging')
    col=bpy.data.collections.new('Export assets');staging.collection.children.link(col)
    copies={};mats={};saved_names={};created_meshes=[];created_materials=[]
    output=ROOT/'public/assets/desk-scene.glb'
    temporary=output.with_name('desk-scene.exporting.glb')
    output.parent.mkdir(parents=True,exist_ok=True)
    (ROOT/'work').mkdir(parents=True,exist_ok=True)
    preserve={'Screen_Surface','PC_Power_Button','Monitor_Power_Button','Drive_Eject_Button','Power_LED','Drive_LED','Monitor_LED','DeskLamp_Bulb','Lamp_Switch','Command_Note','Desk_Top'}
    report=None

    try:
        for obj in list(source.objects):
            if obj.type not in {'MESH','FONT','CURVE','EMPTY'}:continue
            name=obj.name
            saved_names[obj]=name
            obj.name='SOURCE__'+name
            if obj.type=='EMPTY':
                c=bpy.data.objects.new(name,None)
            else:
                mesh=bpy.data.meshes.new_from_object(obj.evaluated_get(deps),depsgraph=deps)
                created_meshes.append(mesh.name)
                c=bpy.data.objects.new(name,mesh)
                # Link immediately so cleanup also catches partial conversion failures.
                col.objects.link(c)
                # Closed surfaces face outward; preserve the open CRT glass orientation.
                if name!='Screen_Surface':
                    bm=bmesh.new()
                    try:
                        bm.from_mesh(mesh)
                        if bm.faces and all(len(e.link_faces)==2 for e in bm.edges):
                            bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
                        bm.to_mesh(mesh)
                    finally:
                        bm.free()
                for i,mat in enumerate(list(mesh.materials)):
                    if not mat:continue
                    if mat.name not in mats:
                        # Use an owned copy; do not alter materials retained by another scene.
                        clean=bpy.data.materials.new(mat.name+'_export');clean.use_nodes=True
                        created_materials.append(clean.name)
                        target=clean.node_tree.nodes.get('Principled BSDF')
                        src=mat.node_tree.nodes.get('Principled BSDF') if mat.use_nodes else None
                        if src is not None:
                            for prop in ['Base Color','Metallic','Roughness','IOR','Specular IOR Level','Emission Color','Emission Strength']:
                                if prop in src.inputs and prop in target.inputs:
                                    target.inputs[prop].default_value=src.inputs[prop].default_value
                        else:
                            target.inputs['Base Color'].default_value=mat.diffuse_color
                        clean.diffuse_color=mat.diffuse_color
                        mats[mat.name]=clean
                    mesh.materials[i]=mats[mat.name]
                # World-scale projected UVs: one wood repeat = two metres.
                if any(m and 'Wood' in m.name for m in mesh.materials):
                    uv=mesh.uv_layers.active or mesh.uv_layers.new(name='UVMap')
                    for p in mesh.polygons:
                        normal=obj.matrix_world.to_3x3()@p.normal
                        axis=max(range(3),key=lambda i:abs(normal[i]))
                        for li in p.loop_indices:
                            pos=obj.matrix_world@mesh.vertices[mesh.loops[li].vertex_index].co
                            coords=(pos.x,pos.y) if axis==2 else ((pos.x,pos.z) if axis==1 else (pos.y,pos.z))
                            uv.data[li].uv=(coords[0]*.5,coords[1]*.5)
            if c.name not in col.objects:
                col.objects.link(c)
            c.matrix_world=obj.matrix_world.copy();copies[obj]=c

        for orig,dup in copies.items():
            if orig.parent in copies:
                mw=dup.matrix_world.copy();dup.parent=copies[orig.parent];dup.matrix_world=mw

        window.scene=staging
        # Merge static geometry with the same material; keep interactive parts independent.
        groups={}
        for obj in list(col.objects):
            if obj.type=='MESH' and not obj.parent and obj.name not in preserve and len(obj.data.materials)==1 and obj.data.materials[0]:
                groups.setdefault(obj.data.materials[0].name,[]).append(obj)
        for material,objects in groups.items():
            if len(objects)<2:continue
            bpy.ops.object.select_all(action='DESELECT')
            for obj in objects:obj.select_set(True)
            bpy.context.view_layer.objects.active=objects[0]
            bpy.ops.object.join();objects[0].name='Static_'+material.replace('_export','')

        bpy.ops.object.select_all(action='SELECT')
        result=bpy.ops.export_scene.gltf(filepath=str(temporary),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_cameras=False,export_lights=False,export_animations=False)
        if 'FINISHED' not in result or not temporary.is_file():
            raise RuntimeError('glTF export did not finish; the previous GLB has been retained.')
        report={'objects':len(staging.objects),'vertices':sum(len(o.data.vertices) for o in staging.objects if o.type=='MESH'),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in staging.objects if o.type=='MESH'),'interactive':[o.name for o in staging.objects if o.name in preserve or o.name=='Floppy_Disk'],'screen':{'center':[0,1.155,.225],'size':[.270,.204]},'disk':{'initial':[.45,.757,.175],'inserted':[.137,.854,.142]}}
        temporary.replace(output)
        (ROOT/'work/model-export.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    finally:
        # Remove staging objects before restoring source names to avoid name suffixes.
        window.scene=previous_scene
        for obj in list(col.objects):
            bpy.data.objects.remove(obj,do_unlink=True)
        bpy.data.scenes.remove(staging)
        bpy.data.collections.remove(col)
        for name in created_meshes:
            mesh=bpy.data.meshes.get(name)
            if mesh is not None and mesh.users==0:
                bpy.data.meshes.remove(mesh)
        for name in created_materials:
            mat=bpy.data.materials.get(name)
            if mat is not None and mat.users==0:
                bpy.data.materials.remove(mat)
        for orig,name in saved_names.items():
            orig.name=name
        if temporary.exists():
            temporary.unlink()

    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blender/1994-desk.blend'))
    print(json.dumps(report))
    return report


export_desk()
