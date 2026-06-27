# CKEditor 富文本 HTML 编写注意事项

这份说明用于协作编写可复制到 CKEditor 内容区的 HTML。目标是让样式在攻略网站、论坛编辑器、移动端预览中尽量稳定，不依赖外部 CSS，也不使用编辑器容易清洗或改写的结构。

## 1. 核心原则

- 所有样式尽量写成行内 `style`，不要依赖 `<style>`、`class`、外链 CSS。
- 内容结构优先使用常见正文标签：`h1`、`h2`、`h3`、`p`、`span`、`strong`、`br`。
- 不要把排版建立在复杂布局上，例如 CSS Grid、复杂 Flex、绝对定位、大量嵌套容器。
- 不要依赖页面背景、全屏容器、固定定位、视口单位来控制正文区域，CKEditor 粘贴后通常只保留内容区片段。
- 样式要以“正文流”为基础：标题、说明块、条目、分隔线依次向下排列。

## 2. 不建议使用的写法

- 不建议使用 `<ul>`、`<ol>`、`<li>`：很多编辑器会重置列表缩进、序号、圆点样式，导致发布后和本地 HTML 不一致。
- 不建议使用 `<section>`、`<article>`、`main` 等语义容器来承载关键样式：部分编辑器或站点会清洗、降级或包裹这些标签。
- 不建议使用 `position: fixed`、`position: sticky`、`position: absolute`：粘贴到内容区后容易遮挡正文或脱离编辑区域。
- 不建议使用 `height: 100vh`、`width: 100vw`、`aspect-ratio` 来控制 CKEditor 版正文：发布页外层容器不可控，容易被拉伸。
- 不建议使用动画、伪元素、CSS 变量、媒体查询：CKEditor 通常不会完整保留。

## 3. 列表效果的替代方案

CKEditor 版本里不要使用真正的有序或无序列表，可以用 `p + span` 自己实现。

示例：

```html
<p style="margin:4px 0;padding-left:18px;color:#333;">
  <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background-color:#ff5c01;margin-right:8px;vertical-align:2px;"></span>这里是条目内容
</p>
```

好处：

- 缩进、圆点颜色、圆点大小都可控。
- 粘贴后不容易被站点改成默认列表样式。
- 移动端和 PC 端显示更一致。

## 4. 标题序号的写法

区域标题建议手写序号，不使用自动列表。

推荐：

```html
<h2 style="margin:18px 0 10px;font-size:18px;color:#222;font-weight:650;">
  <span style="color:#ff5c01;font-weight:650;">1. </span> 区域标题
</h2>
```

子标题也建议手写：

```html
<h3 style="margin:12px 0 6px;font-size:15px;color:#8a4b24;font-weight:650;">① 子区域标题</h3>
```

注意：

- 序号不要交给 `<ol>` 自动生成。
- 序号样式要和标题文字分开，方便单独上色。
- 如果内容顺序调整，要手动检查序号。

## 5. 说明块写法

说明、实测、提示类内容建议用普通段落模拟提示块。

推荐：

```html
<p style="margin:8px 0 10px;padding:10px 12px;background-color:#fff7f2;border-left:4px solid #ff5c01;color:#555;">
  实测：这里写说明内容
</p>
```

注意：

- 不要用复杂卡片嵌套。
- 左侧色条比整块大面积背景更稳。
- 文案前缀统一，比如统一使用“实测：”。

## 6. 颜色和强调

颜色要少而稳定，建议固定一组主色：

- 主强调色：`#ff5c01`
- 正文色：`#333`
- 标题色：`#222`
- 辅助标题色：`#8a4b24`
- 说明文字色：`#555`
- 说明背景色：`#fff7f2`
- 分隔线色：`#f2e5dc`

数字、百分比、关键加成可以用 `span` 单独强调：

```html
伤害<span style="color:#ff5c01;font-weight:650;">+60%</span>
```

## 7. 分隔线写法

不同区域之间建议用一个空段落加上边框做分隔。

```html
<p style="margin:18px 0;border-top:1px solid #f2e5dc;">&nbsp;</p>
```

注意：

- 不建议用 `<hr>`，部分编辑器会重置样式。
- 使用 `&nbsp;` 可以避免空段落被编辑器吞掉。

## 8. 容器控制

CKEditor 版本不要追求完整网页布局，更适合写成“正文片段”。

推荐最外层：

```html
<div style="max-width:860px;margin:0 auto;padding:18px 16px;line-height:1.75;font-size:15px;color:#333;background-color:#fff;">
  正文内容
</div>
```

注意：

- 可以设置 `max-width`，但不要依赖固定宽高。
- 不要使用全屏背景图、固定画布比例、页面级装饰。
- 如果网站会清洗最外层 `div`，正文内部的 `h2`、`h3`、`p` 仍应能独立成立。

## 9. 粘贴前检查清单

- 没有使用 `<ul>`、`<ol>`、`<li>`。
- 没有使用外部 CSS、`class`、`id`。
- 没有使用 `<style>` 标签。
- 关键样式都在每个标签自己的 `style` 里。
- 区域标题序号是手写的，并且顺序正确。
- 说明类文案前缀统一。
- 分隔线、缩进、强调色在编辑器里预览正常。
- 粘贴到 CKEditor 后，在 PC 和手机预览都检查一次。

## 10. 和普通 HTML 版本的区别

普通 HTML 可以追求游戏化界面、卡片布局、比例画布、背景装饰和更复杂的视觉效果。

CKEditor 版本要优先保证：

- 粘贴后不乱。
- 发布后不丢样式。
- 手机端可读。
- 内容结构清楚。
- 即使站点清洗部分外层标签，正文仍然能看。
