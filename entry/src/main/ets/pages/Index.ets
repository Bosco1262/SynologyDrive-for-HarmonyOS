@Entry
@Component
struct Index {
  build() {
    Column({ space: 12 }) {
      Text('Synology Drive for HarmonyOS')
        .fontSize(24)
        .fontWeight(FontWeight.Bold)
      Text('第四阶段基础能力已集成：API鉴权/限流、持久化恢复、断点续传。')
        .fontSize(14)
      Text('下一步可将 src 领域层逻辑接入真实设备文件与网络权限。')
        .fontSize(12)
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
    .padding(24)
  }
}
