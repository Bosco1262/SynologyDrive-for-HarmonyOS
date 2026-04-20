export interface TaskPageItem {
  id: string;
  running: boolean;
  progress: number;
  status: string;
  latestMessage: string;
}

@Component
export struct TasksPage {
  @Prop tasks: TaskPageItem[] = [];

  build() {
    Column({ space: 10 }) {
      Text('同步任务')
        .fontSize(18)
        .fontWeight(FontWeight.Medium)
        .fontColor('#111827')

      List({ space: 8 }) {
        ForEach(this.tasks, (task: TaskPageItem) => {
          ListItem() {
            Column({ space: 8 }) {
              Row() {
                Text(task.id)
                  .fontSize(13)
                  .fontWeight(FontWeight.Medium)
                  .fontColor('#111827')
                Blank()
                Text(task.status)
                  .fontSize(12)
                  .fontColor(task.running ? '#2563EB' : '#6B7280')
              }
              Progress({ value: task.progress, total: 100, type: ProgressType.Linear })
                .width('100%')
                .height(6)
                .color(task.running ? '#3B82F6' : '#A3A3A3')
                .backgroundColor('#E5E7EB')
              Text(task.latestMessage || (task.running ? '任务执行中...' : '任务空闲'))
                .fontSize(12)
                .fontColor('#6B7280')
            }
            .padding(12)
            .backgroundColor('#FFFFFF')
            .borderRadius(10)
            .shadow({ radius: 8, color: '#0F172A10', offsetX: 0, offsetY: 2 })
          }
        }, (task: TaskPageItem) => task.id)
      }
      .layoutWeight(1)
    }
    .width('100%')
    .height('100%')
    .padding(12)
  }
}
