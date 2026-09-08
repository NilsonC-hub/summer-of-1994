# Summer '94

在一间 1994 年美式摇滚少年的卧室里，体验 486 电脑、CRT 显示器、3.5 寸软盘与 DOS 操作。硬件和房间道具在 Blender 中建模，Three.js 负责实时画面与交互。

**[在线进入房间](https://nilsonc-hub.github.io/summer-of-1994/)** · 使用电脑浏览器、鼠标与键盘。

房间以虚构乐队海报、滑板、书和磁带、音响、床及耳机组成生活痕迹。照明来自暖色台灯、熔岩灯与微弱冷色室内补光；开机后屏幕也参与照明。场景已移除窗与百叶窗，运行时不加载室外 HDR。界面采用少量英文和图标，操作提示留在朋友随手写的小纸条里。

## 运行

Windows 下双击项目根目录的 **`启动体验.cmd`**，会自动启动本地服务并打开默认浏览器。已有服务时直接复用，服务在后台运行。此电脑已安装所需 Node.js；运行网页不需要打开 Blender。首次缺少依赖时会自动安装，需要网络连接。

也可以在终端中手动启动：

```sh
npm install
npm run dev -- --port 1994
```

打开 http://127.0.0.1:1994/ 。本项目面向电脑浏览器、鼠标和键盘，不开发手机版。点击 `Enter room` 开始，拖动环顾、滚轮靠近；点击实体开关或底部图标都可以操作。悬停或用 Tab 聚焦图标可查看名称。点击屏幕或 `Use computer` 后，键盘输入会送入模拟电脑；点击 `Back to room` 返回房间视角。`Read note` 可查看小纸条。

## 第一张游戏盘

1. 打开主机和显示器，等待自检结束。
2. 插入桌上的游戏软盘，查看屏幕。
3. 输入 `A:` 并回车，再输入 `DIR` 查看文件。
4. 输入 `STAR`，按屏幕说明开始 STAR COURIER。
5. 方向键或 A/D 控制飞船。完成一轮后输入名字缩写并保存；Esc 可结束本轮并进入保存。
6. 成绩页按 Esc 返回 DOS，可以再次运行验证成绩。等软驱灯熄灭，退盘并关机。

如果开机前插着游戏数据盘，会停在 `Non-System disk`：取出软盘，查看屏幕并按任意键即可继续。

## 游戏配乐

每局开始后播放原创 8 位机风格主题曲 **Midnight Courier**：140 BPM、16 小节，约 27.43 秒循环，包含脉冲旋律、琶音、三角波贝斯与芯片鼓点。结束本局或关闭主机时淡出，右上角声音按钮同时控制音乐和原有音效。只退出屏幕近景时，电脑里的游戏仍在运行，音乐会继续。

音乐由 `src/chiptune.js` 在本机合成一次，然后用音频缓冲循环，无外部音乐下载；切到后台时停止，回到页面后仅在游戏仍在进行时恢复。

## 模拟范围与存储

这是 DOS 行为模拟器和原创像素游戏，没有加载真正的 MS-DOS/BIOS 镜像，也不执行任意 EXE、COM 或 BAT。支持 A:/C:、大小写不敏感、各盘工作目录、绝对/相对路径、DIR（含通配符）、TYPE、CD、MD、单文件 COPY、CLS、HELP、VER、VOL、简单 DATE/TIME/ECHO，以及场景自带的图像查看器。未实现通用软件兼容、管道、重定向、批处理和完整文件系统工具。启动信息里的容量与日期属于场景设定。

成绩保存在运行程序所在目录的 `SCORES.DAT`。复制 STAR.EXE 到 C: 后也可从硬盘运行，存档与软盘上的记录相互独立。虚拟文件和成绩仅存于当前浏览器、当前站点的 localStorage，不会上传；清理站点数据会重置。存储不可用时仅保留当前页面会话。新增场景文件以补缺方式加入旧存档，不覆盖玩家的同名文件、目录冲突或成绩。

<details>
<summary>维护者：隐藏内容与图像查看器</summary>

C 盘根目录直接包含两张彩蛋图、`VIEW.EXE` 和 `PHOTOS.TXT` 留言。开机后输入 `DIR` 就能发现，每张图片用一条 `VIEW` 命令打开。桌面左侧软盘盒边缘另藏着一张朋友的手写贴纸，点击可拿近阅读；没有新增常驻菜单。

```dos
C:
CD \
DIR
VIEW MOON.GIF
VIEW GARAGE.GIF
```

看图时按 Esc 回到原 DOS 目录，再输入另一条命令。查看器的加载失败也可用 Esc 退出。虚拟磁盘中的 `.GIF` 文件映射到项目自带 PNG；这是场景内置查看器，不是通用 GIF 解码器或任意 DOS 程序执行器。

两张图对应 `public/assets/easter/moon.png` 与 `public/assets/easter/garage.png`，由 OpenAI 原生图像生成工具为本项目创作。旧存档只补入缺少的根目录文件，已有同名内容与旧 `GAMES\BONUS` 文件夹都保留。

</details>

## 项目文件

- `blender/1994-desk.blend`：可编辑的完整场景。
- `blender/build_scene.py`：分阶段构建模型的 Blender Python 源码。
- `blender/teen_room.py`：摇滚少年卧室的摆设、海报与道具，由主构建脚本调用。
- `blender/refine_scene.py`：近景外形和法线修正。
- `blender/export_scene.py`：保留交互部件、合并静态几何并导出 GLB。
- `public/assets/desk-scene.glb`：浏览器使用的模型。
- `public/assets/posters/static-youth.png`：原创虚构乐队海报。
- `src/main.js`：实时场景、光影、镜头和物件交互。
- `src/dos.js`、`src/audio.js`：DOS、游戏、持久存储和合成音效。
- `work/asset-sources.md`：外部素材来源及许可。
- `work/visual-review.md`：实际浏览器画面的检查记录。
- `work/font-sources.md`：VT323 终端字体来源及 OFL 许可。

Blender 使用米与 Z 向上，GLB 使用 Y 向上。电脑与道具为项目原创建模：键盘采用 101 键布局，键床与键帽统一坡度；鼠标采用连续拱形外壳和两枚按键。木纹来自 Poly Haven，许可 CC0；旧版 HDR 保留在素材目录但运行时不使用。海报和隐藏图像为本项目生成的原创虚构图像，来源记录见 `work/asset-sources.md`。本版本未调用 Meshy 生成服务，也无需 API key 即可运行。

## 验证

```sh
node --test src/dos.test.js
npm run build
```

最终视觉以浏览器实时画面为准；Blender 离线渲染是建模和光照参考，两者并非相同渲染器。实际检查结果及限制记录在 `work/visual-review.md`，上面的命令仅说明如何执行验证。

## 在线部署

推送到 `master` 后，GitHub Actions 自动运行 DOS 测试、构建网页并发布到 GitHub Pages。线上构建使用 `/summer-of-1994/` 基础路径，模型、字体、纹理和彩蛋图片跟随该路径加载；本地一键启动仍使用根目录地址。

线上与本地地址的浏览器存档各自独立。部署只上传构建后的网页和运行素材，可编辑的 Blender 源文件保留在仓库中。

## 重新生成模型

以下操作会根据源码更新生成的 `.blend` 和 `.glb`。如果手工修改了模型，请先另存副本。第一条命令成功后再执行第二条；第二条会自动导出模型。

```powershell
$blenderExe = 'E:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
& $blenderExe --background --factory-startup --python-exit-code 1 --python 'E:\i486\blender\build_scene.py'
& $blenderExe --background 'E:\i486\blender\1994-desk.blend' --python-exit-code 1 --python 'E:\i486\blender\refine_scene.py'
```

换目录时，将 `I486_ROOT` 环境变量设为项目绝对路径，并调整上面的路径。`build_scene.py` 会加载同目录的 `teen_room.py`；保留 `public/assets`，以便重建时加载木纹和海报。模型规模随场景修改变化，最新对象数及三角形数以导出时生成的 `work/model-export.json` 为准，文件大小以实际 GLB 为准。

浏览器完整流程检查脚本为 `work/browser-check.js`，使用独立的 Playwright CLI 会话运行，避免影响玩家的本地存档。
