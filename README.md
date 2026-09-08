# 软盘里的夏天 · 1994

在浏览器里体验 486 电脑、CRT 显示器、3.5 寸软盘与 DOS 操作的第一人称小场景。核心硬件在 Blender 中建模，Three.js 负责实时画面与交互。

## 运行

```sh
npm install
npm run dev -- --port 1994
```

打开 http://127.0.0.1:1994/ 。本项目面向电脑浏览器、鼠标和键盘，不开发手机版。拖动环顾，滚轮靠近；点击实体开关或底部同名按钮都可以操作。点击屏幕后，键盘输入会送入模拟电脑；点击「回到桌面」退出输入。

## 第一张游戏盘

1. 打开主机和显示器，等待自检结束。
2. 插入桌上的游戏软盘，查看屏幕。
3. 输入 `A:` 并回车，再输入 `DIR` 查看文件。
4. 输入 `STAR`，按屏幕说明开始 STAR COURIER。
5. 方向键或 A/D 控制飞船。完成一轮后输入名字缩写并保存；Esc 可结束本轮并进入保存。
6. 成绩页按 Esc 返回 DOS，可以再次运行验证成绩。等软驱灯熄灭，退盘并关机。

如果开机前插着游戏数据盘，会停在 `Non-System disk`：取出软盘，查看屏幕并按任意键即可继续。

## 模拟范围与存储

这是 DOS 行为模拟器和原创像素游戏，没有加载真正的 MS-DOS/BIOS 镜像，也不执行任意 EXE、COM 或 BAT。支持 A:/C:、大小写不敏感、各盘工作目录、绝对/相对路径、DIR（含通配符）、TYPE、CD、MD、单文件 COPY、CLS、HELP、VER、VOL、简单 DATE/TIME/ECHO。未实现通用软件兼容、管道、重定向、批处理和完整文件系统工具。启动信息里的容量与日期属于场景设定。

成绩保存在运行程序所在目录的 `SCORES.DAT`。复制 STAR.EXE 到 C: 后也可从硬盘运行，存档与软盘上的记录相互独立。虚拟文件和成绩仅存于当前浏览器、当前站点的 localStorage，不会上传；清理站点数据会重置。存储不可用时仅保留当前页面会话。

## 项目文件

- `blender/1994-desk.blend`：可编辑的完整场景。
- `blender/build_scene.py`：分阶段构建模型的 Blender Python 源码。
- `blender/refine_scene.py`：近景外形和法线修正。
- `blender/export_scene.py`：保留交互部件、合并静态几何并导出 GLB。
- `public/assets/desk-scene.glb`：浏览器使用的模型。
- `src/main.js`：实时场景、光影、镜头和物件交互。
- `src/dos.js`、`src/audio.js`：DOS、游戏、持久存储和合成音效。
- `work/asset-sources.md`：外部素材来源及许可。
- `work/visual-review.md`：实际浏览器画面的检查记录。
- `work/font-sources.md`：VT323 终端字体来源及 OFL 许可。

Blender 使用米与 Z 向上，GLB 使用 Y 向上。电脑与道具为项目原创建模；木纹与环境素材来自 Poly Haven，许可 CC0。本版本未调用 Meshy 生成服务，也无需 API key 即可运行。

## 验证

```sh
node --test src/dos.test.js
npm run build
```

最终视觉以浏览器实时画面为准；Blender 离线渲染是建模和光照参考，两者并非相同渲染器。

## 重新生成模型

以下操作会根据源码更新生成的 `.blend` 和 `.glb`。如果手工修改了模型，请先另存副本。第一条命令成功后再执行第二条；第二条会自动导出模型。

```powershell
$blenderExe = 'E:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
& $blenderExe --background --factory-startup --python-exit-code 1 --python 'E:\i486\blender\build_scene.py'
& $blenderExe --background 'E:\i486\blender\1994-desk.blend' --python-exit-code 1 --python 'E:\i486\blender\refine_scene.py'
```

换目录时，将 `I486_ROOT` 环境变量设为项目绝对路径，并调整上面的路径。实际隔离重建、重复构建和重复导出均已通过；生成模型约 2.6 MiB、7.8 万三角形。

浏览器完整流程检查脚本为 `work/browser-check.js`，使用独立的 Playwright CLI 会话运行，避免影响玩家的本地存档。
