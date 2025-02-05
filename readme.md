# koishi-plugin-webdav-stickers

[![npm](https://img.shields.io/npm/v/koishi-plugin-webdav-stickers?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-webdav-stickers)

一个使用 WebDAV 保存表情包的插件

### 你这图很不错，可惜下一秒就是我的了！

这个插件可以把你看上的表情图片保存到支持 WebDAV 的云盘上，通过云盘，你可以将图片分享给其他朋友，或者同步到自己的其他设备上。

<a href="https://oss.homu.space/imgs/2569b559fd71d9a8af6435c729b6d283.jpg" target="_blank">使用效果</a>

使用方法：

1. 从支持 WebDAV 的云盘（如坚果云等）获取 WebDAV 地址和授权密码，并设置一个存放图片的根目录
2. 配置允许使用该插件的用户
3. 为命令[设置别名](/commands/save-sticker)
4. 把表情图发送给 bot 可以接收到的地方。引用表情图，使用命令

---

特性：

- 支持批量保存和动图保存
- 静态图片统一使用了 png 格式（支持透明背景）
- 可设置表情包的最大宽度，避免了表情包尺寸很大的情况
- 支持保存 mface 表情（官方表情图片）
- 可以通过 folder 参数，将表情图保存到云盘的不同文件夹中
