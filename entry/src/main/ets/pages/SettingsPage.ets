export interface SettingsPageViewModel {
  autoSync: boolean;
  bandwidthLimitKb: number;
  quickConnectId: string;
  connected: boolean;
  retryCount: number;
}

@Component
export struct SettingsPage {
  @Prop viewModel: SettingsPageViewModel = {
    autoSync: true,
    bandwidthLimitKb: 1024,
    quickConnectId: '',
    connected: false,
    retryCount: 0
  };

  build() {
    Column({ space: 10 }) {
      Text('设置')
        .fontSize(18)
        .fontWeight(FontWeight.Medium)
        .fontColor('#111827')

      this.settingRow('自动同步', this.viewModel.autoSync ? '已开启' : '已关闭')
      this.settingRow('带宽限制', `${this.viewModel.bandwidthLimitKb} KB/s`)
      this.settingRow('QuickConnect ID', this.viewModel.quickConnectId || '--')
      this.settingRow('连接状态', this.viewModel.connected ? '在线' : '离线')
      this.settingRow('重连次数', `${this.viewModel.retryCount}`)
    }
    .width('100%')
    .height('100%')
    .padding(12)
    .backgroundColor('#FFFFFF')
    .borderRadius(12)
    .shadow({ radius: 10, color: '#0F172A10', offsetX: 0, offsetY: 3 })
  }

  @Builder
  private settingRow(label: string, value: string) {
    Row() {
      Text(label)
        .width(120)
        .fontSize(12)
        .fontColor('#6B7280')
      Text(value)
        .fontSize(13)
        .fontColor('#111827')
    }
    .width('100%')
    .padding({ top: 6, bottom: 6 })
  }
}
