import { LoginPage, LoginPageViewModel } from './LoginPage';
import { FilesPage, FilePageItem } from './FilesPage';
import { TasksPage, TaskPageItem } from './TasksPage';
import { SettingsPage, SettingsPageViewModel } from './SettingsPage';

type DesktopPage = 'login' | 'files' | 'tasks' | 'settings';

interface SidebarItem {
  key: DesktopPage;
  icon: string;
  title: string;
}

interface SyncFileState {
  path: string;
  type: string;
  size: number;
  modifiedAt: number;
  status: string;
}

interface SyncTaskState {
  id: string;
  running: boolean;
  progress: number;
  status: string;
  latestMessage: string;
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { key: 'login', icon: '🔐', title: '登录页' },
  { key: 'files', icon: '📁', title: '文件页' },
  { key: 'tasks', icon: '🔄', title: '任务页' },
  { key: 'settings', icon: '⚙️', title: '设置页' }
];

@Entry
@Component
struct Index {
  @State activePage: DesktopPage = 'login';
  @State searchText: string = '';
  @State isSyncing: boolean = false;
  @State username: string = 'bosco';
  @State token: string = '';
  @State quickConnectId: string = 'my-synology';
  @State serverAddress: string = '';
  @State connected: boolean = false;
  @State retryCount: number = 0;
  @State connectionMessage: string = '请输入 QuickConnect ID 并连接 NAS';
  @State autoSync: boolean = true;
  @State bandwidthLimitKb: number = 1024;

  @State files: SyncFileState[] = [
    { path: '/Work/Product/PRD_v6.docx', type: 'file', size: 2113536, modifiedAt: Date.now() - 3600000, status: '已同步' },
    { path: '/Work/Design/DesignSystem.sketch', type: 'file', size: 88473600, modifiedAt: Date.now() - 5400000, status: '已同步' },
    { path: '/Team/Roadmap_2026.xlsx', type: 'file', size: 3565158, modifiedAt: Date.now() - 9600000, status: '已同步' }
  ];

  @State tasks: SyncTaskState[] = [
    { id: 'full-sync', running: false, progress: 100, status: 'idle', latestMessage: '全量同步完成' },
    { id: 'incremental-sync', running: false, progress: 100, status: 'idle', latestMessage: '增量同步空闲' }
  ];

  private get visibleFiles(): SyncFileState[] {
    const keyword = this.searchText.trim().toLowerCase();
    if (!keyword) {
      return this.files;
    }
    return this.files.filter((item: SyncFileState) => item.path.toLowerCase().includes(keyword));
  }

  private toFilePageItems(): FilePageItem[] {
    return this.visibleFiles.map((item: SyncFileState) => ({
      path: item.path,
      type: item.type,
      size: `${(item.size / 1024).toFixed(1)} KB`,
      modified: new Date(item.modifiedAt).toLocaleString(),
      status: item.status
    }));
  }

  private toTaskPageItems(): TaskPageItem[] {
    return this.tasks.map((task: SyncTaskState) => ({
      id: task.id,
      running: task.running,
      progress: task.progress,
      status: task.status,
      latestMessage: task.latestMessage
    }));
  }

  private connectQuickConnect(): void {
    if (!this.quickConnectId.trim()) {
      this.connectionMessage = 'QuickConnect ID 不能为空';
      return;
    }
    this.connected = true;
    this.serverAddress = `https://${this.quickConnectId}.quickconnect.to`;
    this.connectionMessage = `已连接到 ${this.serverAddress}`;
  }

  private reconnectQuickConnect(): void {
    this.retryCount += 1;
    this.connected = false;
    this.connectionMessage = `连接断开，正在第 ${this.retryCount} 次重试...`;
    this.connectQuickConnect();
  }

  private runIncrementalSync(): void {
    this.isSyncing = !this.isSyncing;
    this.tasks = this.tasks.map((task: SyncTaskState) => this.updateTaskStatus(task));
    this.files = this.files.map((file: SyncFileState) => ({
      ...file,
      status: this.isSyncing ? '同步中' : '已同步'
    }));
  }

  private updateTaskStatus(task: SyncTaskState): SyncTaskState {
    if (task.id !== 'incremental-sync') {
      return task;
    }
    if (this.isSyncing) {
      return {
        ...task,
        running: true,
        status: 'running',
        progress: 40,
        latestMessage: '检测到本地变更，开始上传分片...'
      };
    }
    return {
      ...task,
      running: false,
      status: 'idle',
      progress: 100,
      latestMessage: '增量同步完成'
    };
  }

  @Builder
  private renderTitleBar() {
    Row() {
      Row({ space: 10 }) {
        Text('☁️').fontSize(20)
        Column({ space: 2 }) {
          Text('Synology Drive').fontSize(16).fontWeight(FontWeight.Medium).fontColor('#111827')
          Text('HarmonyOS Windows 风格多页面').fontSize(11).fontColor('#6B7280')
        }
      }

      Blank()

      TextInput({ text: $$this.searchText, placeholder: '搜索文件路径' })
        .width(280)
        .height(36)
        .fontSize(13)
        .backgroundColor('#F9FAFB')
        .borderRadius(10)
        .border({ width: 1, color: '#E5E7EB' })
        .padding({ left: 10, right: 10 })

      TextInput({ text: $$this.quickConnectId, placeholder: 'QuickConnect ID' })
        .width(180)
        .height(36)
        .fontSize(13)
        .backgroundColor('#FFFFFF')
        .borderRadius(10)
        .border({ width: 1, color: '#D1D5DB' })
        .padding({ left: 10, right: 10 })

      Row({ space: 8 }) {
        Button('连接')
          .height(34)
          .fontSize(12)
          .backgroundColor('#2563EB')
          .fontColor('#FFFFFF')
          .borderRadius(8)
          .onClick(() => this.connectQuickConnect())

        Button('重连')
          .height(34)
          .fontSize(12)
          .backgroundColor('#4B5563')
          .fontColor('#FFFFFF')
          .borderRadius(8)
          .onClick(() => this.reconnectQuickConnect())

        Button(this.isSyncing ? '同步中...' : '立即同步')
          .height(34)
          .fontSize(12)
          .backgroundColor(this.isSyncing ? '#93C5FD' : '#16A34A')
          .fontColor('#FFFFFF')
          .borderRadius(8)
          .onClick(() => this.runIncrementalSync())
      }
    }
    .height(64)
    .width('100%')
    .padding({ left: 16, right: 16 })
    .backgroundColor('#FFFFFF')
    .border({ width: 1, color: '#E5E7EB' })
  }

  @Builder
  private renderSidebar() {
    Column({ space: 8 }) {
      ForEach(SIDEBAR_ITEMS, (item: SidebarItem) => {
        Row({ space: 10 }) {
          Text(item.icon).fontSize(16)
          Text(item.title)
            .fontSize(13)
            .fontColor(this.activePage === item.key ? '#1D4ED8' : '#374151')
            .fontWeight(this.activePage === item.key ? FontWeight.Medium : FontWeight.Normal)
          Blank()
        }
        .width('100%')
        .height(40)
        .padding({ left: 12, right: 10 })
        .backgroundColor(this.activePage === item.key ? '#E0EAFF' : '#F8FAFC')
        .borderRadius(8)
        .onClick(() => {
          this.activePage = item.key;
        })
      }, (item: SidebarItem) => item.key)

      Blank()

      Column({ space: 8 }) {
        Text('连接状态').width('100%').fontSize(12).fontColor('#6B7280')
        Text(this.connected ? 'QuickConnect 在线' : 'QuickConnect 离线')
          .width('100%')
          .fontSize(12)
          .fontColor(this.connected ? '#16A34A' : '#EF4444')
        Text(`重连次数：${this.retryCount}`)
          .width('100%')
          .fontSize(11)
          .fontColor('#6B7280')
      }
      .padding(12)
      .backgroundColor('#FFFFFF')
      .borderRadius(10)
    }
    .width('100%')
    .height('100%')
    .padding(10)
    .backgroundColor('#F8FAFC')
  }

  @Builder
  private renderPageContent() {
    if (this.activePage === 'login') {
      const vm: LoginPageViewModel = {
        username: this.username,
        quickConnectId: this.quickConnectId,
        connected: this.connected,
        serverAddress: this.serverAddress,
        message: this.connectionMessage
      };
      LoginPage({ viewModel: vm });
      return;
    }

    if (this.activePage === 'files') {
      FilesPage({ files: this.toFilePageItems() });
      return;
    }

    if (this.activePage === 'tasks') {
      TasksPage({ tasks: this.toTaskPageItems() });
      return;
    }

    const settings: SettingsPageViewModel = {
      autoSync: this.autoSync,
      bandwidthLimitKb: this.bandwidthLimitKb,
      quickConnectId: this.quickConnectId,
      connected: this.connected,
      retryCount: this.retryCount
    };
    SettingsPage({ viewModel: settings });
  }

  @Builder
  private renderBottomBar() {
    Row() {
      Text(this.connectionMessage)
        .fontSize(12)
        .fontColor('#374151')
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
      Blank()
      Text(`文件 ${this.visibleFiles.length} 项 · 任务 ${this.tasks.length} 项`)
        .fontSize(12)
        .fontColor('#6B7280')
    }
    .width('100%')
    .height(36)
    .padding({ left: 16, right: 16 })
    .backgroundColor('#F9FAFB')
    .border({ width: 1, color: '#E5E7EB' })
  }

  build() {
    Column({ space: 0 }) {
      this.renderTitleBar()
      Row({ space: 10 }) {
        Column() {
          this.renderSidebar()
        }
        .width('20%')
        .height('100%')

        Column() {
          this.renderPageContent()
        }
        .width('80%')
        .height('100%')
      }
      .layoutWeight(1)
      .padding(10)

      this.renderBottomBar()
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#EEF2F7')
  }
}
