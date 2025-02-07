import { type Context, Random, Schema, Session } from "koishi";
import sharp from "sharp";
import { imageSize } from "image-size";
async function loadWebDAV() {
  const webdav = await import("webdav");
  console.log(webdav);
  // 这里可以使用 webdav
  return webdav;
}
async function loadImageType() {
  const imageType = await import("image-type");
  console.log(imageType);
  return imageType.default;
}

export const name = "webdav-stickers";
export const usage = `
### 你这图很不错，可惜下一秒就是我的了！

这个插件可以把你看上的表情图片保存到支持 WebDAV 的云盘上，通过云盘，你可以将图片分享给其他朋友，或者同步到自己的其他设备上。

<a href="https://oss.homu.space/imgs/2569b559fd71d9a8af6435c729b6d283.jpg" target="_blank">使用效果</a>

使用方法：
1. 从支持 WebDAV 的云盘（如坚果云等）获取 WebDAV 地址和授权密码，并设置一个存放图片的根目录
2. 配置允许使用该插件的用户
3. 为命令[设置别名](/commands/save-sticker)
4. 把表情图发送给bot可以接收到的地方。引用表情图，使用命令

---

特性：
- 支持批量保存和动图保存
- 静态图片统一使用了png格式（支持透明背景）
- 可设置表情包的最大宽度，避免了表情包尺寸很大的情况
- 支持保存mface表情（官方表情图片）
- 可以通过 folder 参数，将表情图保存到云盘的不同文件夹中

`;

export const inject = ["http"];
export interface Config {
  webdavUrl: string;
  webdavUsername: string;
  webdavPassword: string;
  rootFolder: string;
  allowUsers: string[];
  // triggerWords: string[];
  successMessage: string[];
  stickerWidth: number;
  staticImageFormat: "png" | "gif" | "jpg";
}

interface ImageElement {
  file: string; // 文件名
  fileSize: string; // 文件大小
  src: string; // 文件地址
  subType: string; // 文件类型
}

interface MfaceElement {
  emojiId: string;
  emojiPackageId: string;
  key: string;
  summary: string;
  url: string;
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    webdavUrl: Schema.string().required().description("WebDAV 服务器地址"),
    webdavUsername: Schema.string().required().description("WebDAV 用户名"),
    webdavPassword: Schema.string()
      .role("secret")
      .required()
      .description("WebDAV 授权密码"),
    rootFolder: Schema.string()
      .default("Stickers")
      .description("设定一个存放图片的根目录"),
  }).description("WebDAV 配置"),
  Schema.object({
    allowUsers: Schema.array(Schema.string())
      .required()
      .description("允许使用该插件的用户（qq号）"),
    successMessage: Schema.array(Schema.string())
      .default(["搞定！"])
      .description("获取成功后的消息"),
  }).description("用户配置"),
  Schema.object({
    stickerWidth: Schema.number()
      .default(300)
      .description("表情包的宽度，默认300px，超过尺寸的静态图片会被压缩"),
    staticImageFormat: Schema.union(["png", "gif", "jpg"])
      .default("gif")
      .description("静态图片的格式，默认gif，不会处理mface"),
  }).description("图片配置"),
]);

export async function apply(ctx: Context) {
  const { createClient } = await loadWebDAV();
  const imageType = await loadImageType();
  ctx.logger.info("成功加载 imageType 和 webdav");
  const webDavUrl = ctx.config.webdavUrl.endsWith("/")
    ? ctx.config.webdavUrl
    : ctx.config.webdavUrl + "/" + ctx.config.rootFolder;
  ctx.logger.info("webDavUrl: " + webDavUrl);
  const webdavClient = createClient(webDavUrl, {
    username: ctx.config.webdavUsername,
    password: ctx.config.webdavPassword,
  });

  async function saveImage(image: ImageElement, folder?: string) {
    if (folder && !(await webdavClient.exists(`/${folder}`))) {
      await webdavClient.createDirectory(`/${folder}`);
    }
    let buffer = await ctx.http.get(image.src);

    // 检测文件是否是gif
    const fileType = await imageType(buffer);
    ctx.logger.info(`文件类型: ${fileType.ext}`);
    let filename: string;

    if (fileType.ext === "gif") {
      filename = `${Date.now()}.gif`;
    } else {
      filename = `${Date.now()}.${ctx.config.staticImageFormat}`;
      const size = imageSize(new Uint8Array(buffer));
      if (size.width > ctx.config.stickerWidth) {
        buffer = await sharp(buffer)
          .resize({ width: ctx.config.stickerWidth })
          .toFormat(ctx.config.staticImageFormat)
          .toBuffer();
      } else {
        buffer = await sharp(buffer)
          .toFormat(ctx.config.staticImageFormat)
          .toBuffer();
      }
    }

    // 如果图片大于设定大小，并且不是gif，则压缩
    const savePath = `${folder ? folder + "/" : ""}${filename}`;

    await webdavClient.putFileContents(savePath, buffer, {
      overwrite: true,
    });

    ctx.logger.info(
      `${filename} 已保存至 ${ctx.config.webdavUrl}/${ctx.config.rootFolder}/${savePath}`
    );
  }

  async function saveMface(mface: MfaceElement, folder?: string) {
    if (folder && !(await webdavClient.exists(`/${folder}`))) {
      await webdavClient.createDirectory(`/${folder}`);
    }

    const extension = mface.url.split(".").pop();
    const filename = `${mface.emojiPackageId}-${mface.summary}.${extension}`;
    const savePath = `${folder ? folder + "/" : ""}${filename}`;

    let buffer = await ctx.http.get(mface.url);
    await webdavClient.putFileContents(savePath, buffer, {
      overwrite: true,
    });

    ctx.logger.info(
      `${filename} 已保存至 ${ctx.config.webdavUrl}/${ctx.config.rootFolder}/${savePath}`
    );
  }

  ctx
    .user(...ctx.config.allowUsers)
    .command("save-sticker <folder:text>", "获取表情包", {
      // @ts-ignore-next-line
      hidden: true,
      captureQuote: false,
    })
    .alias("盗图", "保存图片")
    .action(async ({ session }, folder) => {
      const quote = session.quote;
      ctx.logger.info(quote, "quote");
      if (!quote) return;

      const images: Array<ImageElement> = [];
      const mfaces: Array<MfaceElement> = [];

      quote.elements.forEach((el) => {
        if (el.type === "img") {
          images.push(el.attrs as ImageElement);
        }
        if (el.type === "mface") {
          mfaces.push(el.attrs as MfaceElement);
        }
      });

      if (images.length === 0 && mfaces.length === 0) {
        session.send("引用的消息里没有图片吧");
        return;
      }

      ctx.logger.info({ images, mfaces, folder });
      const promises = [
        ...images.map((image) => saveImage(image, folder)),
        ...mfaces.map((mface) => saveMface(mface, folder)),
      ];

      Promise.allSettled(promises).then((results) => {
        const rejected = results.filter((r) => r.status === "rejected");
        const fulfilled = results.filter((r) => r.status === "fulfilled");

        if (fulfilled.length === 0) {
          session.send("没有拿到图片，好像出了点问题...");
        } else if (fulfilled.length > 0 && rejected.length > 0) {
          session.send("部分图片没有拿到...");
        } else {
          session.send(Random.pick(ctx.config.successMessage));
        }
        if (rejected.length > 0) {
          ctx.logger.error(rejected.map((r) => r.reason));
        }
      });
    });
}
