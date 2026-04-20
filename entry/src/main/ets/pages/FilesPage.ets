export interface FilePageItem {
  path: string;
  type: string;
  size: string;
  modified: string;
  status: string;
}

@Component
export struct FilesPage {
  @Prop files: FilePageItem[] = [];

  private statusColor(status: string): string {
    if (status === '已同步') {
      return '#22C55E';
    }
    if (status === '同步中') {
      return '#3B82F6';
    }
    if (status === '错误') {
      return '#EF4444';
    }
    return '#F59E0B';
  }

  build() {
    Column({ space: 0 }) {
      Row() {
        Text('文件路径').layoutWeight(4).fontSize(12).fontColor('#6B7280')
        Text('类型').layoutWeight(1).fontSize(12).fontColor('#6B7280')
        Text('大小').layoutWeight(1).fontSize(12).fontColor('#6B7280')
        Text('修改时间').layoutWeight(2).fontSize(12).fontColor('#6B7280')
        Text('状态').layoutWeight(1).fontSize(12).fontColor('#6B7280')
      }
      .height(40)
      .padding({ left: 14, right: 14 })
      .backgroundColor('#F9FAFB')
      .border({ width: 1, color: '#E5E7EB' })

      List({ space: 4 }) {
        ForEach(this.files, (item: FilePageItem) => {
          ListItem() {
            Row() {
              Text(item.path)
                .layoutWeight(4)
                .fontSize(12)
                .fontColor('#111827')
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis })
              Text(item.type).layoutWeight(1).fontSize(12).fontColor('#4B5563')
              Text(item.size).layoutWeight(1).fontSize(12).fontColor('#4B5563')
              Text(item.modified).layoutWeight(2).fontSize(12).fontColor('#4B5563')
              Row({ space: 6 }) {
                Text('●').fontSize(9).fontColor(this.statusColor(item.status))
                Text(item.status).fontSize(12).fontColor('#374151')
              }
              .layoutWeight(1)
            }
            .height(44)
            .padding({ left: 14, right: 14 })
            .backgroundColor('#FFFFFF')
            .borderRadius(8)
          }
        }, (item: FilePageItem) => item.path)
      }
      .layoutWeight(1)
      .padding(6)
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#FFFFFF')
    .borderRadius(12)
    .shadow({ radius: 10, color: '#0F172A10', offsetX: 0, offsetY: 3 })
  }
}
