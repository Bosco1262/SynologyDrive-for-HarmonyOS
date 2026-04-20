export interface LoginPageViewModel {
  username: string;
  quickConnectId: string;
  connected: boolean;
  serverAddress: string;
  message: string;
}

@Component
export struct LoginPage {
  @Prop viewModel: LoginPageViewModel = {
    username: '',
    quickConnectId: '',
    connected: false,
    serverAddress: '',
    message: ''
  };

  build() {
    Column({ space: 14 }) {
      Text('登录')
        .fontSize(24)
        .fontWeight(FontWeight.Bold)
        .fontColor('#111827')

      Text(this.viewModel.message || '输入账户后连接 NAS')
        .fontSize(13)
        .fontColor('#6B7280')

      Column({ space: 8 }) {
        this.rowItem('账号', this.viewModel.username || '--')
        this.rowItem('QuickConnect ID', this.viewModel.quickConnectId || '--')
        this.rowItem('连接状态', this.viewModel.connected ? '已连接' : '未连接')
        this.rowItem('服务器地址', this.viewModel.serverAddress || '--')
      }
      .padding(14)
      .backgroundColor('#FFFFFF')
      .borderRadius(12)
      .shadow({ radius: 10, color: '#0F172A10', offsetX: 0, offsetY: 3 })
    }
    .width('100%')
    .height('100%')
    .padding(16)
  }

  @Builder
  private rowItem(label: string, value: string) {
    Row() {
      Text(label)
        .width(120)
        .fontSize(12)
        .fontColor('#6B7280')
      Text(value)
        .fontSize(13)
        .fontColor('#111827')
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
    }
    .width('100%')
  }
}
