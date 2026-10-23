# WATO — 网站

东京·龟户的儿童绘画与初高中生素描教室官网。纯静态站点，无需构建工具，可直接部署到 GitHub Pages。

## 文件结构

```
├── index.html          首页：学生作品轮播（默认页）
├── about.html          コンセプト / 理念
├── courses.html        コース / 课程
├── works.html          作品一览（深色画廊页）
├── teachers.html       講師 / 师资
├── fees.html           料金・時間割 / 学费·课表
├── contact.html        お問い合わせ / 联系（含体验课报名表单）
├── assets/
│   ├── css/style.css   全站共享样式
│   ├── js/i18n.js      三语文案 + 作品标题（日/中/英）
│   ├── js/main.js      共享脚本：菜单、语言切换、轮播、素材自动加载
│   ├── media/          视频（video_0.mp4、video_1.mp4 …）
│   └── works/          学生作品图片（按编号命名：01.jpg、02.jpg …）
└── README.md
```

## 首页轮播规则

首页打开后**默认自动播放 `assets/media/video_0.mp4`**（静音自动播放，播完自动切到下一张）。
轮播顺序 = 视频（按 video_0、video_1 … 编号）→ 作品图片（按 01、02 … 编号），图片每 6 秒切换。

## 如何添加/更换素材

- **图片**：放进 `assets/works/`，按两位数编号命名：`09.jpg`、`10.png` 等
  （支持 jpg / jpeg / png / webp / svg；编号必须连续，中断处即为最后一张）
- **视频**：放进 `assets/media/`，命名为 `video_2.mp4` 等（编号从 0 起连续）
- 首页轮播和「作品」页会**自动**显示新素材，无需改代码
- （可选）在 `assets/js/i18n.js` 底部给作品/视频加三语标题：

```js
const WORKS_CAPTIONS = {
  1:{ja:["「静物デッサン」","高2・鉛筆"], zh:["《静物素描》","高二·铅笔"], en:["\"Still Life\"","Grade 11 · Pencil"]},
};
```

没有标题时会自动显示「作品 01 · デッサン」。

## 如何修改文案

所有文字都集中在 `assets/js/i18n.js`，按 ja / zh / en 三个区块对应三种语言。
修改时请保持三个语言区块的 key 一致。菜单顺序在 `assets/js/main.js` 顶部的 `PAGES` 数组里调整。

## 正式上线前

- 删除每个 html 文件 `<head>` 里的 `<meta name="robots" content="noindex, nofollow">`（共 7 处），搜索引擎才会收录
- 替换 `contact.html` 里的占位电话和邮箱
- 报名表单目前是演示效果，需接入 Formspree 等表单服务才能真正收到邮件

## 本地预览

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000
```

（作品自动加载依赖 HTTP 环境，直接双击 html 文件可能无法显示图片）
