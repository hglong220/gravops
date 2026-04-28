using System.Diagnostics;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Gravops.Desktop;

public sealed class MainForm : Form
{
    private const string BackendUrl = "http://localhost:3000";
    private const int ZcyCdpPort = 9223;
    private static readonly Color AppBackground = Color.FromArgb(244, 244, 244);
    private static readonly Color Surface = Color.White;
    private static readonly Color Border = Color.FromArgb(224, 224, 224);
    private static readonly Color TextStrong = Color.FromArgb(22, 22, 22);
    private static readonly Color TextMuted = Color.FromArgb(82, 82, 82);
    private static readonly Color Accent = Color.FromArgb(15, 98, 254);
    private static readonly Color AccentHover = Color.FromArgb(0, 80, 230);
    private static readonly Color BrowserChrome = Color.FromArgb(244, 244, 244);
    private static readonly Color BrowserChromeBorder = Color.FromArgb(224, 224, 224);
    private static readonly Font UiFont = new("Microsoft YaHei UI", 9.5f);
    private static readonly Font UiFontMedium = new("Microsoft YaHei UI", 9.5f, FontStyle.Regular);
    private readonly WebView2 appView = new();
    private readonly WebView2 browserView = new();
    private readonly WebView2 zcyView = new();
    private readonly Panel appViewHost = new();
    private readonly Panel appLoadingOverlay = new();
    private readonly Label appLoadingLabel = new();
    private readonly TabControl workTabs = new();
    private readonly TextBox addressBox = new();
    private readonly Label statusLabel = new();
    private Process? backendProcess;
    private readonly string desktopLogPath = Path.Combine(AppContext.BaseDirectory, "desktop-read.log");
    private readonly object jdImageResponseLock = new();
    private readonly List<string> jdImageResponses = new();
    private readonly object jdNetworkCaptureLock = new();
    private readonly List<JdNetworkCapture> jdNetworkCaptures = new();
    private int jdNetworkCaptureSeq;
    private string? activeJdCaptureId;
    private string? activeJdCaptureProductId;
    private string? activeJdCapturePageUrl;
    private string? pendingZcyPublishJson;
    private readonly ListView nativeTaskList = new();
    private readonly TextBox nativeJdUrlBox = new();
    private readonly TextBox nativeSearchBox = new();
    private readonly Label nativeStatsLabel = new();
    private readonly Label nativeDetailLabel = new();
    private readonly Label nativeMessageLabel = new();
    private readonly Button nativePublishButton = new();
    private readonly Button nativeRefreshButton = new();
    private readonly Button nativeReadButton = new();
    private readonly List<NativeDraft> nativeDrafts = new();

    private sealed class NativeDraft
    {
        public string Id { get; set; } = "";
        public string Title { get; set; } = "";
        public string OriginalUrl { get; set; } = "";
        public string Brand { get; set; } = "";
        public string Model { get; set; } = "";
        public string Status { get; set; } = "";
        public string CategoryPath { get; set; } = "";
        public string Price { get; set; } = "";
        public string MarketPrice { get; set; } = "";
        public int MainImageCount { get; set; }
        public int DetailImageCount { get; set; }
        public bool NeedsReview => string.IsNullOrWhiteSpace(Title)
            || string.IsNullOrWhiteSpace(Brand)
            || string.IsNullOrWhiteSpace(Model)
            || string.IsNullOrWhiteSpace(CategoryPath)
            || MainImageCount == 0
            || DetailImageCount == 0
            || !decimal.TryParse(Price, out var price) || price <= 0
            || !decimal.TryParse(MarketPrice, out var marketPrice) || marketPrice <= 0;
    }

    private sealed class JdNetworkCapture
    {
        public int Seq { get; set; }
        public string Url { get; set; } = "";
        public string Kind { get; set; } = "";
        public string Source { get; set; } = "";
        public string ContentType { get; set; } = "";
        public string Body { get; set; } = "";
        public string CaptureId { get; set; } = "";
        public string ProductId { get; set; } = "";
        public string SkuId { get; set; } = "";
        public string PageUrl { get; set; } = "";
        public long Timestamp { get; set; }
    }

    public MainForm()
    {
        Text = "Gravops";
        Width = 1500;
        Height = 960;
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = AppBackground;
        Font = UiFont;
        var appIcon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        if (appIcon is not null)
        {
            Icon = appIcon;
        }

        BuildLayout();
        Load += async (_, _) =>
        {
            try
            {
                await InitializeAsync();
            }
            catch (Exception error)
            {
                LogDesktopRead($"initialize-error: {error}");
                SetStatus($"启动未完成：{error.Message}");
                nativeMessageLabel.Text = $"启动未完成：{error.Message}";
            }
        };
        FormClosing += (_, _) => StopBackend();
    }

    private void BuildLayout()
    {
        var root = new SplitContainer
        {
            Dock = DockStyle.Fill,
            Orientation = Orientation.Vertical,
            BackColor = BrowserChromeBorder,
            SplitterWidth = 5
        };
        root.HandleCreated += (_, _) =>
        {
            root.Panel1MinSize = 320;
            root.Panel2MinSize = 720;
            root.SplitterDistance = Math.Max(root.Panel1MinSize, root.Width / 4);
        };

        var appShell = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 2,
            RowCount = 1,
            BackColor = AppBackground
        };
        appShell.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 52));
        appShell.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        appShell.Controls.Add(BuildDesktopSidebar(), 0, 0);
        appShell.Controls.Add(BuildAppViewHost(), 1, 0);
        root.Panel1.Controls.Add(appShell);

        var rightPanel = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            RowCount = 3,
            ColumnCount = 1,
            BackColor = AppBackground
        };
        rightPanel.RowStyles.Add(new RowStyle(SizeType.Absolute, 48));
        rightPanel.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        rightPanel.RowStyles.Add(new RowStyle(SizeType.Absolute, 28));

        var toolbar = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 8,
            Padding = new Padding(8, 7, 8, 5),
            BackColor = BrowserChrome
        };
        toolbar.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 42));
        toolbar.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 42));
        toolbar.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 42));
        toolbar.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        toolbar.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 122));
        toolbar.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 0));
        toolbar.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 0));
        toolbar.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 0));

        toolbar.Controls.Add(MakeButton("<", async () => await GoBackAsync()), 0, 0);
        toolbar.Controls.Add(MakeButton(">", async () => await GoForwardAsync()), 1, 0);
        toolbar.Controls.Add(MakeButton("R", async () => await ReloadAsync()), 2, 0);

        addressBox.Dock = DockStyle.Fill;
        addressBox.PlaceholderText = "输入京东或政采云网址";
        addressBox.BorderStyle = BorderStyle.FixedSingle;
        addressBox.Font = UiFont;
        addressBox.ForeColor = TextStrong;
        addressBox.BackColor = Surface;
        addressBox.Margin = new Padding(4, 3, 8, 3);
        addressBox.KeyDown += async (_, e) =>
        {
            if (e.KeyCode == Keys.Enter)
            {
                e.SuppressKeyPress = true;
                await NavigateWorkbenchAsync(addressBox.Text);
            }
        };
        toolbar.Controls.Add(addressBox, 3, 0);

        toolbar.Controls.Add(MakeButton("读取当前商品", async () => await ReadCurrentJdAsync()), 4, 0);

        browserView.Dock = DockStyle.Fill;
        zcyView.Dock = DockStyle.Fill;
        workTabs.Dock = DockStyle.Fill;
        workTabs.Font = UiFont;
        workTabs.Padding = new Point(14, 4);
        workTabs.DrawMode = TabDrawMode.OwnerDrawFixed;
        workTabs.SizeMode = TabSizeMode.Fixed;
        workTabs.ItemSize = new Size(78, 28);
        workTabs.DrawItem += DrawWorkbenchTab;

        var jdPage = new TabPage("京东");
        jdPage.BackColor = Surface;
        jdPage.Controls.Add(browserView);
        var zcyPage = new TabPage("政采云");
        zcyPage.BackColor = Surface;
        zcyPage.Controls.Add(zcyView);
        workTabs.TabPages.Add(jdPage);
        workTabs.TabPages.Add(zcyPage);
        workTabs.SelectedIndexChanged += (_, _) =>
        {
            var active = GetActiveWorkbench();
            addressBox.Text = active.Source?.ToString() ?? addressBox.Text;
        };

        statusLabel.Dock = DockStyle.Fill;
        statusLabel.TextAlign = ContentAlignment.MiddleLeft;
        statusLabel.Padding = new Padding(8, 0, 0, 0);
        statusLabel.Font = new Font("Microsoft YaHei UI", 8.5f);
        statusLabel.ForeColor = TextMuted;
        statusLabel.BackColor = BrowserChrome;

        var workbenchFrame = new Panel
        {
            Dock = DockStyle.Fill,
            BackColor = Color.FromArgb(224, 224, 224),
            Padding = new Padding(1, 0, 1, 1)
        };
        workbenchFrame.Controls.Add(workTabs);

        rightPanel.Controls.Add(toolbar, 0, 0);
        rightPanel.Controls.Add(workbenchFrame, 0, 1);
        rightPanel.Controls.Add(statusLabel, 0, 2);
        root.Panel2.Controls.Add(rightPanel);

        Controls.Add(root);
    }

    private Control BuildDesktopSidebar()
    {
        var sidebar = new Panel
        {
            Dock = DockStyle.Fill,
            BackColor = Surface,
            Padding = new Padding(0)
        };

        var accountMenu = new ContextMenuStrip
        {
            Font = UiFont,
            BackColor = Surface,
            ForeColor = TextStrong,
            ShowImageMargin = false,
            Padding = new Padding(6)
        };
        accountMenu.Items.Add("账户设置", null, (_, _) => ShowDesktopAccountSettings());
        accountMenu.Items.Add(new ToolStripSeparator());
        accountMenu.Items.Add("退出登录", null, async (_, _) => await LogoutAppAsync());

        var avatar = new Button
        {
            Text = "G",
            Width = 40,
            Height = 40,
            FlatStyle = FlatStyle.Flat,
            BackColor = TextStrong,
            ForeColor = Color.White,
            Font = new Font("Segoe UI", 13, FontStyle.Bold),
            Cursor = Cursors.Hand
        };
        avatar.FlatAppearance.BorderSize = 0;
        avatar.Resize += (_, _) => MakeCircle(avatar);
        avatar.Click += (_, _) => accountMenu.Show(avatar, new Point(0, -accountMenu.Height));
        sidebar.Controls.Add(avatar);
        sidebar.Resize += (_, _) =>
        {
            avatar.Left = (sidebar.Width - avatar.Width) / 2;
            avatar.Top = Math.Max(10, sidebar.Height - avatar.Height - 18);
            MakeCircle(avatar);
        };

        return sidebar;
    }

    private Control BuildAppViewHost()
    {
        appViewHost.Dock = DockStyle.Fill;
        appViewHost.BackColor = AppBackground;

        appView.Dock = DockStyle.Fill;
        appView.Visible = false;
        appViewHost.Controls.Add(appView);

        appLoadingOverlay.Dock = DockStyle.Fill;
        appLoadingOverlay.BackColor = AppBackground;
        appLoadingOverlay.Padding = new Padding(32, 36, 32, 32);

        appLoadingLabel.Dock = DockStyle.Top;
        appLoadingLabel.Height = 56;
        appLoadingLabel.Text = "任务中心加载中...";
        appLoadingLabel.Font = new Font("Microsoft YaHei UI", 11f, FontStyle.Regular);
        appLoadingLabel.ForeColor = TextMuted;
        appLoadingLabel.TextAlign = ContentAlignment.MiddleLeft;
        appLoadingOverlay.Controls.Add(appLoadingLabel);
        appLoadingOverlay.BringToFront();
        appViewHost.Controls.Add(appLoadingOverlay);

        return appViewHost;
    }

    private void SetAppViewLoading(bool loading)
    {
        if (InvokeRequired)
        {
            BeginInvoke(new Action(() => SetAppViewLoading(loading)));
            return;
        }

        appLoadingOverlay.Visible = loading;
        appView.Visible = !loading;
        if (loading)
        {
            appLoadingOverlay.BringToFront();
        }
        else
        {
            appView.BringToFront();
        }
    }

    private static void MakeCircle(Control control)
    {
        using var path = new System.Drawing.Drawing2D.GraphicsPath();
        path.AddEllipse(0, 0, control.Width - 1, control.Height - 1);
        control.Region = new Region(path);
    }

    private void ShowDesktopAccountSettings()
    {
        MessageBox.Show(
            "Gravops 账户\n\n状态：已登录\n授权：由桌面软件启动时自动校验\n\n后续可在这里加入设备授权、缓存清理、版本信息。",
            "账户设置",
            MessageBoxButtons.OK,
            MessageBoxIcon.Information
        );
    }

    private static void StyleDesktopNavButton(Button button, bool active)
    {
        button.FlatStyle = FlatStyle.Flat;
        button.FlatAppearance.BorderSize = active ? 0 : 1;
        button.FlatAppearance.BorderColor = Border;
        button.BackColor = active ? TextStrong : Surface;
        button.ForeColor = active ? Color.White : Color.FromArgb(71, 85, 105);
        button.Font = new Font("Microsoft YaHei UI", 10.5f, FontStyle.Regular);
        button.Margin = new Padding(0, 6, 0, 6);
    }

    private async Task LogoutAppAsync()
    {
        try
        {
            await appView.CoreWebView2.ExecuteScriptAsync("""
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
                location.replace('/');
            """);
        }
        catch (Exception error)
        {
            LogDesktopRead($"logout-error: {error.Message}");
        }
    }

    private Control BuildNativeTaskCenter()
    {
        var background = AppBackground;
        var text = TextStrong;
        var muted = TextMuted;

        var shell = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            BackColor = background,
            RowCount = 5,
            ColumnCount = 1,
            Padding = new Padding(18, 18, 18, 16)
        };
        shell.RowStyles.Add(new RowStyle(SizeType.Absolute, 68));
        shell.RowStyles.Add(new RowStyle(SizeType.Absolute, 104));
        shell.RowStyles.Add(new RowStyle(SizeType.Absolute, 48));
        shell.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        shell.RowStyles.Add(new RowStyle(SizeType.Absolute, 144));

        var header = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            RowCount = 2,
            Margin = new Padding(2, 0, 2, 8)
        };
        header.RowStyles.Add(new RowStyle(SizeType.Absolute, 38));
        header.RowStyles.Add(new RowStyle(SizeType.Absolute, 24));
        header.Controls.Add(new Label
        {
            Text = "Gravops",
            Dock = DockStyle.Fill,
            Font = new Font("Segoe UI", 22, FontStyle.Bold),
            ForeColor = text
        }, 0, 0);
        nativeStatsLabel.Text = "任务中心准备中";
        nativeStatsLabel.Dock = DockStyle.Fill;
        nativeStatsLabel.ForeColor = muted;
        nativeStatsLabel.Font = new Font("Microsoft YaHei UI", 9.5f);
        header.Controls.Add(nativeStatsLabel, 0, 1);
        shell.Controls.Add(header, 0, 0);

        var collectPanel = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            RowCount = 2,
            ColumnCount = 1,
            BackColor = Surface,
            Padding = new Padding(14),
            Margin = new Padding(0, 0, 0, 12)
        };
        collectPanel.RowStyles.Add(new RowStyle(SizeType.Absolute, 42));
        collectPanel.RowStyles.Add(new RowStyle(SizeType.Absolute, 34));
        nativeJdUrlBox.Dock = DockStyle.Fill;
        nativeJdUrlBox.Multiline = false;
        nativeJdUrlBox.PlaceholderText = "粘贴京东商品链接，或在右侧京东页点击读取";
        nativeJdUrlBox.BorderStyle = BorderStyle.FixedSingle;
        nativeJdUrlBox.Font = new Font("Microsoft YaHei UI", 10);
        collectPanel.Controls.Add(nativeJdUrlBox, 0, 0);
        nativeReadButton.Text = "读取商品";
        nativeReadButton.Dock = DockStyle.Fill;
        StyleButton(nativeReadButton, primary: true);
        nativeReadButton.Click += async (_, _) => await ReadNativeJdAsync();
        collectPanel.Controls.Add(nativeReadButton, 0, 1);
        shell.Controls.Add(collectPanel, 0, 1);

        var actionBar = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 3, RowCount = 1 };
        actionBar.Margin = new Padding(0, 0, 0, 10);
        actionBar.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        actionBar.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 78));
        actionBar.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 78));
        nativeSearchBox.Dock = DockStyle.Fill;
        nativeSearchBox.PlaceholderText = "搜索标题 / 品牌 / 型号";
        nativeSearchBox.BorderStyle = BorderStyle.FixedSingle;
        nativeSearchBox.Font = new Font("Microsoft YaHei UI", 10);
        nativeSearchBox.Margin = new Padding(0, 4, 10, 4);
        nativeSearchBox.TextChanged += (_, _) => RenderNativeTasks();
        actionBar.Controls.Add(nativeSearchBox, 0, 0);
        nativeRefreshButton.Text = "刷新";
        nativeRefreshButton.Dock = DockStyle.Fill;
        StyleButton(nativeRefreshButton);
        nativeRefreshButton.Click += async (_, _) => await RefreshNativeTasksAsync();
        actionBar.Controls.Add(nativeRefreshButton, 1, 0);
        nativePublishButton.Text = "发布";
        nativePublishButton.Dock = DockStyle.Fill;
        nativePublishButton.Enabled = false;
        StyleButton(nativePublishButton, primary: true);
        nativePublishButton.Click += async (_, _) => await PublishSelectedNativeDraftAsync();
        actionBar.Controls.Add(nativePublishButton, 2, 0);
        shell.Controls.Add(actionBar, 0, 2);

        var listPanel = new Panel
        {
            Dock = DockStyle.Fill,
            BackColor = Surface,
            Padding = new Padding(1),
            Margin = new Padding(0, 0, 0, 12)
        };
        nativeTaskList.Dock = DockStyle.Fill;
        nativeTaskList.View = View.Details;
        nativeTaskList.FullRowSelect = true;
        nativeTaskList.HideSelection = false;
        nativeTaskList.MultiSelect = false;
        nativeTaskList.BorderStyle = BorderStyle.None;
        nativeTaskList.GridLines = false;
        nativeTaskList.HeaderStyle = ColumnHeaderStyle.Nonclickable;
        nativeTaskList.BackColor = Surface;
        nativeTaskList.ForeColor = text;
        nativeTaskList.Font = new Font("Microsoft YaHei UI", 9.5f);
        nativeTaskList.Columns.Add("商品", 300);
        nativeTaskList.Columns.Add("状态", 72);
        nativeTaskList.Columns.Add("图片", 62);
        nativeTaskList.SelectedIndexChanged += (_, _) => UpdateNativeDetailPanel();
        listPanel.Controls.Add(nativeTaskList);
        shell.Controls.Add(listPanel, 0, 3);

        var detailPanel = new Panel
        {
            Dock = DockStyle.Fill,
            BackColor = Surface,
            Padding = new Padding(14)
        };
        nativeDetailLabel.Dock = DockStyle.Fill;
        nativeDetailLabel.ForeColor = Color.FromArgb(51, 65, 85);
        nativeDetailLabel.Font = new Font("Microsoft YaHei UI", 9.5f);
        nativeDetailLabel.Text = "选择一个商品查看确认信息";
        detailPanel.Controls.Add(nativeDetailLabel);
        nativeMessageLabel.Dock = DockStyle.Bottom;
        nativeMessageLabel.Height = 28;
        nativeMessageLabel.ForeColor = Color.FromArgb(37, 99, 235);
        nativeMessageLabel.Font = new Font("Microsoft YaHei UI", 9);
        detailPanel.Controls.Add(nativeMessageLabel);
        shell.Controls.Add(detailPanel, 0, 4);

        return shell;
    }

    private static void StyleButton(Button button, bool primary = false)
    {
        button.FlatStyle = FlatStyle.Flat;
        button.FlatAppearance.BorderSize = 1;
        button.FlatAppearance.BorderColor = primary ? Accent : Border;
        button.BackColor = primary ? Accent : Surface;
        button.ForeColor = primary ? Color.White : TextStrong;
        button.Font = UiFontMedium;
        button.Margin = new Padding(4);
        button.Cursor = Cursors.Hand;
    }

    private Button MakeButton(string text, Func<Task> action)
    {
        var primary = string.Equals(text, "读取当前商品", StringComparison.Ordinal);
        var button = new Button
        {
            Text = text,
            Dock = DockStyle.Fill,
            Margin = new Padding(3),
            FlatStyle = FlatStyle.Flat,
            BackColor = primary ? Accent : Surface,
            ForeColor = primary ? Color.White : TextStrong,
            Font = UiFontMedium,
            Cursor = Cursors.Hand
        };
        button.FlatAppearance.BorderSize = 1;
        button.FlatAppearance.BorderColor = primary ? Accent : Border;
        button.MouseEnter += (_, _) =>
        {
            if (!button.Enabled) return;
            button.BackColor = primary ? AccentHover : Color.FromArgb(248, 248, 248);
        };
        button.MouseLeave += (_, _) =>
        {
            button.BackColor = primary ? Accent : Surface;
        };
        button.Click += async (_, _) =>
        {
            try
            {
                await action();
            }
            catch (Exception error)
            {
                LogDesktopRead($"button-error {text}: {error}");
                ShowError($"操作失败：{error.Message}");
            }
        };
        return button;
    }

    private void DrawWorkbenchTab(object? sender, DrawItemEventArgs e)
    {
        if (e.Index < 0 || e.Index >= workTabs.TabPages.Count) return;

        var selected = e.Index == workTabs.SelectedIndex;
        var bounds = e.Bounds;
        bounds.Inflate(-3, -3);

        using var background = new SolidBrush(selected ? Surface : BrowserChrome);
        using var border = new Pen(selected ? BrowserChromeBorder : Color.Transparent);
        e.Graphics.FillRectangle(background, bounds);
        e.Graphics.DrawRectangle(border, bounds);

        var text = workTabs.TabPages[e.Index].Text;
        TextRenderer.DrawText(
            e.Graphics,
            text,
            UiFont,
            bounds,
            selected ? TextStrong : TextMuted,
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis
        );
    }

    private async Task InitializeAsync()
    {
        SetStatus("正在启动 Gravops 后台...");
        if (await IsBackendReadyAsync())
        {
            SetStatus("检测到 Gravops 后台已运行");
        }
        else
        {
            StartBackend();
        }

        var userDataRoot = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Gravops",
            "WebView2"
        );
        Directory.CreateDirectory(userDataRoot);

        await appView.EnsureCoreWebView2Async(
            await CoreWebView2Environment.CreateAsync(null, Path.Combine(userDataRoot, "app"))
        );
        await browserView.EnsureCoreWebView2Async(
            await CoreWebView2Environment.CreateAsync(null, Path.Combine(userDataRoot, "workbench"))
        );
        var zcyOptions = new CoreWebView2EnvironmentOptions($"--remote-debugging-port={ZcyCdpPort}");
        await zcyView.EnsureCoreWebView2Async(
            await CoreWebView2Environment.CreateAsync(null, Path.Combine(userDataRoot, "zcy"), zcyOptions)
        );

        await InstallDesktopAppChromeAsync();

        browserView.CoreWebView2.WebResourceResponseReceived += (_, e) => _ = CaptureJdNetworkResponseAsync(e);

        appView.CoreWebView2.NewWindowRequested += (_, e) =>
        {
            e.Handled = true;
            NavigateExternalWorkbenchUri(e.Uri);
        };
        browserView.CoreWebView2.NewWindowRequested += (_, e) =>
        {
            e.Handled = true;
            if (!string.IsNullOrWhiteSpace(e.Uri))
            {
                NavigateExternalWorkbenchUri(e.Uri);
            }
        };
        zcyView.CoreWebView2.NewWindowRequested += (_, e) =>
        {
            e.Handled = true;
            if (!string.IsNullOrWhiteSpace(e.Uri))
            {
                NavigateExternalWorkbenchUri(e.Uri);
            }
        };
        appView.CoreWebView2.WebMessageReceived += (_, e) => _ = HandleAppWebMessageAsync(e);
        appView.CoreWebView2.NavigationStarting += (_, _) =>
        {
            SetAppViewLoading(true);
        };
        appView.CoreWebView2.NavigationCompleted += async (_, _) =>
        {
            await ApplyDesktopAppChromeAsync();
            await Task.Delay(80);
            SetAppViewLoading(false);
        };
        browserView.CoreWebView2.NavigationStarting += (_, e) =>
        {
            ClearJdNetworkCaptures();
            if (workTabs.SelectedIndex == 0) addressBox.Text = e.Uri;
            SetStatus(e.Uri);
        };
        zcyView.CoreWebView2.NavigationStarting += (_, e) =>
        {
            if (workTabs.SelectedIndex == 1) addressBox.Text = e.Uri;
            SetStatus(e.Uri);
        };
        browserView.CoreWebView2.NavigationCompleted += (_, _) =>
        {
            if (workTabs.SelectedIndex == 0) addressBox.Text = browserView.Source?.ToString() ?? addressBox.Text;
        };
        zcyView.CoreWebView2.NavigationCompleted += async (_, _) =>
        {
            if (workTabs.SelectedIndex == 1) addressBox.Text = zcyView.Source?.ToString() ?? addressBox.Text;
            await TryStartPendingZcyPublishAsync();
        };

        await WaitForBackendAsync();
        await NavigateAppViewAsync($"{BackendUrl}/dashboard/tasks");
        browserView.CoreWebView2.Navigate("https://www.jd.com/");
        zcyView.CoreWebView2.Navigate("https://www.zcygov.cn/goods-center/goods/publish");
        SetStatus("就绪");
    }

    private async Task InstallDesktopAppChromeAsync()
    {
        await appView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(DesktopAppPreloadStyleScript);
        await appView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(DesktopAppChromeScript);
    }

    private async Task ApplyDesktopAppChromeAsync()
    {
        try
        {
            await appView.CoreWebView2.ExecuteScriptAsync(DesktopAppChromeScript);
        }
        catch (Exception error)
        {
            LogDesktopRead($"desktop-chrome-apply-error: {error.Message}");
        }
    }

    private const string DesktopAppChromeScript = """
        (() => {
          const hiddenTexts = ['总览', '授权管理', '软件下载', '账户设置', '退出登录'];
          const hiddenPaths = ['/dashboard', '/dashboard/license', '/dashboard/downloads', '/dashboard/settings'];
          const forbiddenPaths = ['/dashboard/license', '/dashboard/downloads', '/dashboard/settings'];
          const keepTexts = ['任务中心'];

          function normalize(text) {
            return String(text || '').replace(/\s+/g, '').trim();
          }

          function isHiddenText(text) {
            const value = normalize(text);
            return hiddenTexts.some(item => value === item || value.includes(item));
          }

          function isKeptText(text) {
            const value = normalize(text);
            return keepTexts.some(item => value === item || value.includes(item));
          }

          function shouldHideText(text) {
            const value = normalize(text);
            return hiddenTexts.some(item => value === item);
          }

          function shouldHideHref(href) {
            if (!href) return false;
            let path = href;
            try {
              path = new URL(href, location.origin).pathname;
            } catch {}
            return hiddenPaths.includes(path);
          }

          function hideJdCollectCard() {
            const nodes = Array.from(document.querySelectorAll('input,textarea,button,div'));
            const collectNode = nodes.find(node => {
              const placeholder = node.getAttribute?.('placeholder') || '';
              const text = node.innerText || node.textContent || '';
              return placeholder.includes('粘贴京东商品链接') || normalize(text) === '读取京东商品';
            });
            if (!collectNode) return;

            let current = collectNode;
            for (let i = 0; current && i < 8; i += 1) {
              const text = current.innerText || current.textContent || '';
              const hasInput = !!current.querySelector?.('input,textarea');
              const hasReadButton = normalize(text).includes('读取京东商品');
              if (hasInput && hasReadButton) {
                current.style.display = 'none';
                current.setAttribute('aria-hidden', 'true');
                return;
              }
              current = current.parentElement;
            }
          }

          function hideTaskModeControls() {
            const exactTexts = ['全选', '单品采集(2)', '批量采集(0)', '单品采集', '批量采集'];
            const nodes = Array.from(document.querySelectorAll('label,button,span,div'));
            for (const node of nodes) {
              const text = normalize(node.innerText || node.textContent || '');
              if (!exactTexts.includes(text)) continue;
              const entry = node.closest('label,button') || node;
              entry.style.display = 'none';
              entry.setAttribute('aria-hidden', 'true');
            }

            for (const input of Array.from(document.querySelectorAll('input[type="checkbox"]'))) {
              const parentText = normalize(input.parentElement?.innerText || input.parentElement?.textContent || '');
              if (parentText === '全选') {
                input.parentElement.style.display = 'none';
                input.parentElement.setAttribute('aria-hidden', 'true');
              }
            }
          }

          function hideNavigationEntry(node) {
            if (!node || node.dataset?.gravopsDesktopHidden === '1') return;
            node.dataset.gravopsDesktopHidden = '1';
            node.style.display = 'none';
            node.setAttribute('aria-hidden', 'true');
          }

          function findByText(text) {
            return Array.from(document.querySelectorAll('a,button,[role="button"],li,nav div,aside div'))
              .find(node => normalize(node.innerText || node.textContent || '') === text);
          }

          function styleLogout() {
            const logout = findByText('退出登录');
            if (!logout) return;
            const entry = closestNavigationEntry(logout);
            entry.dataset.gravopsDesktopLogout = '1';
            entry.style.position = 'absolute';
            entry.style.left = '28px';
            entry.style.right = '28px';
            entry.style.bottom = '24px';
            entry.style.width = 'auto';
            entry.style.height = '40px';
            entry.style.display = 'flex';
            entry.style.alignItems = 'center';
            entry.style.justifyContent = 'center';
            entry.style.borderRadius = '10px';
            entry.style.background = 'transparent';
            entry.style.border = '1px solid rgba(148, 163, 184, 0.35)';
            entry.style.color = '#64748b';
            entry.style.fontSize = '14px';
            entry.style.fontWeight = '500';
            entry.style.boxShadow = 'none';
          }

          function ensureAccountDock() {
            if (document.getElementById('gravops-desktop-account-dock')) return;
            const sidebar =
              document.querySelector('aside') ||
              Array.from(document.querySelectorAll('nav, div')).find(node => {
                const text = normalize(node.innerText || node.textContent || '');
                return text.includes('Gravops') && text.includes('任务中心');
              });
            if (!sidebar) return;
            sidebar.style.position = sidebar.style.position || 'relative';
            const dock = document.createElement('div');
            dock.id = 'gravops-desktop-account-dock';
            dock.innerHTML = '<div style="width:28px;height:28px;border-radius:999px;background:#eef6ff;color:#2563eb;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;">G</div><div style="min-width:0;flex:1;"><div style="font-size:13px;font-weight:600;color:#0f172a;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Gravops 账户</div><div style="font-size:12px;color:#94a3b8;line-height:16px;">已登录</div></div>';
            dock.style.position = 'absolute';
            dock.style.left = '28px';
            dock.style.right = '28px';
            dock.style.bottom = '76px';
            dock.style.display = 'flex';
            dock.style.alignItems = 'center';
            dock.style.gap = '10px';
            dock.style.padding = '10px 12px';
            dock.style.borderRadius = '12px';
            dock.style.background = '#f8fafc';
            dock.style.border = '1px solid rgba(226, 232, 240, 0.9)';
            sidebar.appendChild(dock);
          }

          function closestNavigationEntry(node) {
            const direct = node.closest('a,button,[role="button"],li,[data-sidebar-item]');
            if (direct) return direct;
            let current = node;
            for (let i = 0; current && i < 4; i += 1) {
              const text = normalize(current.innerText || current.textContent || '');
              if (hiddenTexts.includes(text) || keepTexts.includes(text)) return current;
              current = current.parentElement;
            }
            return node;
          }

          function apply() {
            if (forbiddenPaths.includes(location.pathname) || location.pathname === '/dashboard') {
              location.replace('/dashboard/tasks');
              return;
            }

            const styleId = 'gravops-desktop-content-only-style';
            if (!document.getElementById(styleId)) {
              const style = document.createElement('style');
              style.id = styleId;
              style.textContent = `
                aside,
                .lg\\:hidden,
                .fixed.inset-0.z-40 {
                  display: none !important;
                }
                body {
                  overflow: hidden !important;
                  background: #f4f4f4 !important;
                  color: #161616 !important;
                  font-family: "Microsoft YaHei UI", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif !important;
                }
                main {
                  padding: 22px 24px !important;
                  background: #f4f4f4 !important;
                }
                main > div {
                  background: #f4f4f4 !important;
                }
                h1, h2, h3 {
                  color: #161616 !important;
                  letter-spacing: 0 !important;
                }
                h1 {
                  font-size: 25px !important;
                  line-height: 1.18 !important;
                  font-weight: 760 !important;
                  margin-bottom: 3px !important;
                }
                p, span, label, button, input, textarea, select {
                  font-family: "Microsoft YaHei UI", "Segoe UI", system-ui, sans-serif !important;
                }
                input, textarea, select {
                  color: #161616 !important;
                  border-color: #e0e0e0 !important;
                  border-radius: 8px !important;
                  background: #ffffff !important;
                  box-shadow: none !important;
                }
                input:focus, textarea:focus, select:focus {
                  border-color: #0f62fe !important;
                  box-shadow: 0 0 0 2px rgba(15, 98, 254, 0.18) !important;
                  outline: none !important;
                }
                button {
                  border-radius: 8px !important;
                  font-weight: 520 !important;
                  letter-spacing: 0 !important;
                  box-shadow: none !important;
                  transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease, opacity 120ms ease !important;
                }
                button[class*="bg-blue-600"],
                button[class*="hover:bg-blue-700"] {
                  background: #0f62fe !important;
                  border-color: #0f62fe !important;
                  color: #ffffff !important;
                }
                button[class*="bg-gray-300"] {
                  background: #e0e0e0 !important;
                  color: #8d8d8d !important;
                  border: 1px solid #c6c6c6 !important;
                }
                button[class*="bg-red-50"] {
                  background: #fff1f1 !important;
                  color: #da1e28 !important;
                  border-color: #ffb3b8 !important;
                }
                button[class*="bg-gray-100"] {
                  background: #f4f4f4 !important;
                  color: #393939 !important;
                }
                button:hover:not(:disabled) {
                  opacity: 0.94 !important;
                }
                table {
                  border-collapse: separate !important;
                  border-spacing: 0 !important;
                }
                thead, th {
                  background: #e0e0e0 !important;
                  color: #161616 !important;
                  font-weight: 650 !important;
                  border-bottom: 1px solid #e0e0e0 !important;
                }
                tr {
                  transition: background-color 120ms ease !important;
                }
                tbody tr:hover {
                  background: #f4f4f4 !important;
                }
                tbody td {
                  border-color: #e0e0e0 !important;
                }
                [class*="text-gray"], [class*="text-slate"] {
                  color: #525252 !important;
                }
                a {
                  color: #0f62fe !important;
                  text-decoration: none !important;
                }
                main > div > div:first-child p {
                  color: #525252 !important;
                  font-size: 13px !important;
                }
                main > div > div[class*="bg-white"][class*="border"] {
                  border-color: #e0e0e0 !important;
                  border-radius: 10px !important;
                  background: #ffffff !important;
                }
                main > div > div[class*="overflow-hidden"][class*="flex-col"] {
                  border-color: #e0e0e0 !important;
                  border-radius: 10px !important;
                  background: #ffffff !important;
                  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04) !important;
                }
                main > div > div[class*="overflow-hidden"][class*="flex-col"] > div {
                  background: #ffffff !important;
                }
                main tbody {
                  background: #ffffff !important;
                }
                main tbody tr {
                  background: #ffffff !important;
                }
                main table {
                  table-layout: fixed !important;
                  width: 100% !important;
                }
                main thead th {
                  white-space: nowrap !important;
                  overflow: hidden !important;
                  text-overflow: ellipsis !important;
                }
                main thead th:nth-child(1),
                main tbody td:nth-child(1) {
                  width: 52px !important;
                  min-width: 52px !important;
                  max-width: 52px !important;
                  padding-left: 14px !important;
                  padding-right: 6px !important;
                }
                main thead th:nth-child(2),
                main tbody td:nth-child(2) {
                  width: auto !important;
                  min-width: 0 !important;
                  padding-left: 6px !important;
                  padding-right: 6px !important;
                }
                main thead th:nth-child(3),
                main thead th:nth-child(4),
                main thead th:nth-child(5),
                main tbody td:nth-child(3),
                main tbody td:nth-child(4),
                main tbody td:nth-child(5) {
                  display: none !important;
                }
                main thead th:nth-child(6),
                main tbody td:nth-child(6) {
                  width: 74px !important;
                  min-width: 74px !important;
                  max-width: 74px !important;
                  padding-left: 4px !important;
                  padding-right: 12px !important;
                }
                main tbody td:nth-child(2) span {
                  display: block !important;
                  overflow: hidden !important;
                  text-overflow: ellipsis !important;
                  white-space: nowrap !important;
                  max-width: 100% !important;
                }
                main tbody tr {
                  height: 58px !important;
                }
                main tbody td {
                  vertical-align: middle !important;
                }
                main tbody td:nth-child(6) > div {
                  justify-content: flex-end !important;
                }
                .fixed.inset-0.bg-black {
                  background: rgba(15, 23, 42, 0.42) !important;
                  backdrop-filter: blur(2px) !important;
                }
                .fixed.inset-0.bg-black > div > div.bg-white {
                  border-radius: 14px !important;
                  border: 1px solid rgba(226, 232, 240, 0.96) !important;
                  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.16) !important;
                }
                input[type="checkbox"] {
                  accent-color: #0f62fe !important;
                }
              `;
              document.head.appendChild(style);
            }

            const candidates = Array.from(document.querySelectorAll('a,button,[role="button"],li,nav div,aside div,aside span,aside p'));
            for (const node of candidates) {
              const text = node.innerText || node.textContent || '';
              const normalizedText = normalize(text);
              if (!hiddenTexts.includes(normalizedText) && !keepTexts.includes(normalizedText) && normalizedText.length > 12) continue;
              if (isKeptText(text)) continue;
              const href = node.getAttribute?.('href') || '';
              if (shouldHideText(text) || shouldHideHref(href)) {
                hideNavigationEntry(closestNavigationEntry(node));
              }
            }

            document.querySelectorAll('#gravops-desktop-account-dock').forEach(node => node.remove());
            hideJdCollectCard();
            hideTaskModeControls();
          }

          apply();
          if (!window.__gravopsDesktopChromeObserver) {
            window.__gravopsDesktopChromeObserver = new MutationObserver(apply);
            window.__gravopsDesktopChromeObserver.observe(document.documentElement, {
              childList: true,
              subtree: true,
              characterData: true
            });
          }
        })();
        """;

    private const string DesktopAppPreloadStyleScript = """
        (() => {
          const css = `
            html {
              background: #f4f4f4 !important;
            }
            body {
              background: #f4f4f4 !important;
              color: #161616 !important;
              font-family: "Microsoft YaHei UI", "Segoe UI", system-ui, sans-serif !important;
            }
            aside,
            .lg\\:hidden,
            .fixed.inset-0.z-40 {
              display: none !important;
            }
            main {
              padding: 22px 24px !important;
            }
          `;

          function inject() {
            if (document.getElementById('gravops-desktop-preload-style')) return;
            const style = document.createElement('style');
            style.id = 'gravops-desktop-preload-style';
            style.textContent = css;
            (document.head || document.documentElement).appendChild(style);
          }

          inject();
          if (document.readyState === 'loading') {
            document.addEventListener('readystatechange', inject, { once: true });
          }
        })();
        """;

    private void StartBackend()
    {
        var repoRoot = FindRepoRoot();
        var backendDir = Path.Combine(repoRoot, "zhengcaiyun-backend");
        var npm = OperatingSystem.IsWindows() ? "npm.cmd" : "npm";

        backendProcess = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = npm,
                Arguments = "run dev",
                WorkingDirectory = backendDir,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            },
            EnableRaisingEvents = true
        };
        backendProcess.OutputDataReceived += (_, e) => { if (!string.IsNullOrWhiteSpace(e.Data)) SetStatus(e.Data); };
        backendProcess.ErrorDataReceived += (_, e) => { if (!string.IsNullOrWhiteSpace(e.Data)) SetStatus(e.Data); };
        backendProcess.Start();
        backendProcess.BeginOutputReadLine();
        backendProcess.BeginErrorReadLine();
    }

    private void StopBackend()
    {
        try
        {
            if (backendProcess is { HasExited: false })
            {
                backendProcess.Kill(entireProcessTree: true);
            }
        }
        catch
        {
            // Ignore shutdown cleanup failures.
        }
    }

    private static string FindRepoRoot()
    {
        var dir = AppContext.BaseDirectory;
        while (!string.IsNullOrWhiteSpace(dir))
        {
            if (Directory.Exists(Path.Combine(dir, "zhengcaiyun-backend")))
            {
                return dir;
            }
            dir = Directory.GetParent(dir)?.FullName ?? "";
        }

        return Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", ".."));
    }

    private async Task WaitForBackendAsync()
    {
        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
        for (var i = 0; i < 90; i++)
        {
            try
            {
                using var res = await client.GetAsync($"{BackendUrl}/api/copy/drafts");
                if ((int)res.StatusCode < 500) return;
            }
            catch (Exception error)
            {
                if (i % 10 == 0)
                {
                    LogDesktopRead($"backend-wait {i}: {error.Message}");
                }
                await Task.Delay(500);
            }
        }

        SetStatus("后台接口暂时没有响应，可稍后点击刷新重试");
        nativeMessageLabel.Text = "后台接口暂时没有响应，可稍后点击刷新重试";
    }

    private static async Task<bool> IsBackendReadyAsync()
    {
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
            using var res = await client.GetAsync($"{BackendUrl}/api/copy/drafts");
            return (int)res.StatusCode < 500;
        }
        catch
        {
            return false;
        }
    }

    private async Task NavigateWorkbenchAsync(string rawUrl)
    {
        var url = NormalizeUrl(rawUrl);
        if (url is null)
        {
            SetStatus("网址格式不正确");
            return;
        }

        var target = url.Contains("zcygov.cn", StringComparison.OrdinalIgnoreCase) ? zcyView : browserView;
        workTabs.SelectedIndex = ReferenceEquals(target, zcyView) ? 1 : 0;
        target.CoreWebView2.Navigate(url);
        addressBox.Text = url;
        await Task.CompletedTask;
    }

    private void NavigateExternalWorkbenchUri(string? rawUrl)
    {
        if (string.IsNullOrWhiteSpace(rawUrl)) return;

        var url = NormalizeUrl(rawUrl);
        if (url is null) return;

        var target = url.Contains("zcygov.cn", StringComparison.OrdinalIgnoreCase) ? zcyView : browserView;
        workTabs.SelectedIndex = ReferenceEquals(target, zcyView) ? 1 : 0;
        target.CoreWebView2.Navigate(url);
        addressBox.Text = url;
        SetStatus(url);
    }

    private async Task HandleAppWebMessageAsync(CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
            using var doc = JsonDocument.Parse(e.WebMessageAsJson);
            var root = doc.RootElement;
            if (!root.TryGetProperty("type", out var typeProp)) return;
            if (!string.Equals(typeProp.GetString(), "TRIGGER_ZCY_PUBLISH", StringComparison.Ordinal)) return;
            if (!root.TryGetProperty("data", out var dataProp) || dataProp.ValueKind != JsonValueKind.Object)
            {
                ShowError("发布数据为空，无法启动政采云流程");
                return;
            }

            var zcyUrl = dataProp.TryGetProperty("zcyUrl", out var zcyUrlProp)
                ? zcyUrlProp.GetString()
                : null;
            if (string.IsNullOrWhiteSpace(zcyUrl))
            {
                ShowError("发布链接为空，无法启动政采云流程");
                return;
            }

            pendingZcyPublishJson = dataProp.GetRawText();
            workTabs.SelectedIndex = 1;
            zcyView.CoreWebView2.Navigate(zcyUrl);
            addressBox.Text = zcyUrl;
            SetStatus("正在启动政采云发布流程...");
            await Task.CompletedTask;
        }
        catch (Exception error)
        {
            LogDesktopRead($"zcy-publish-message-error: {error}");
            ShowError($"发布指令解析失败：{error.Message}");
        }
    }

    private async Task TryStartPendingZcyPublishAsync()
    {
        if (string.IsNullOrWhiteSpace(pendingZcyPublishJson)) return;

        var currentUrl = zcyView.Source?.ToString() ?? "";
        if (!currentUrl.Contains("zcygov.cn", StringComparison.OrdinalIgnoreCase)) return;
        if (!currentUrl.Contains("/goods/category/attr/select", StringComparison.OrdinalIgnoreCase) &&
            !currentUrl.Contains("/goods/publish", StringComparison.OrdinalIgnoreCase) &&
            !currentUrl.Contains("/goods/edit", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        try
        {
            await StartZcyPlaywrightPublisherAsync(pendingZcyPublishJson);
            pendingZcyPublishJson = null;
            SetStatus("政采云 Playwright 发布流程已启动");
        }
        catch (Exception error)
        {
            LogDesktopRead($"zcy-publisher-inject-error: {error}");
            ShowError($"政采云发布执行器启动失败：{error.Message}");
        }
    }

    private async Task StartZcyPlaywrightPublisherAsync(string payloadJson)
    {
        var repoRoot = FindRepoRoot();
        var backendDir = Path.Combine(repoRoot, "zhengcaiyun-backend");
        var scriptPath = Path.Combine(backendDir, "scripts", "zcy-publish-cdp.cjs");
        if (!File.Exists(scriptPath))
        {
            ShowError("未找到政采云 Playwright 发布脚本");
            return;
        }

        var payloadDir = Path.Combine(Path.GetTempPath(), "Gravops");
        Directory.CreateDirectory(payloadDir);
        var payloadPath = Path.Combine(payloadDir, $"zcy-publish-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}.json");
        await File.WriteAllTextAsync(payloadPath, payloadJson, new UTF8Encoding(false));

        var node = OperatingSystem.IsWindows() ? "node.exe" : "node";
        var outputLock = new object();
        var outputLines = new List<string>();
        void CapturePublisherLine(string prefix, string line)
        {
            if (string.IsNullOrWhiteSpace(line)) return;
            var entry = $"{prefix}: {line}";
            lock (outputLock)
            {
                outputLines.Add(entry);
                if (outputLines.Count > 12) outputLines.RemoveAt(0);
            }
            LogDesktopRead(entry);
        }

        var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = node,
                Arguments = $"\"{scriptPath}\" --port {ZcyCdpPort} --payload \"{payloadPath}\"",
                WorkingDirectory = backendDir,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8
            },
            EnableRaisingEvents = true
        };

        process.OutputDataReceived += (_, e) =>
        {
            if (!string.IsNullOrWhiteSpace(e.Data)) CapturePublisherLine("zcy-cdp", e.Data);
        };
        process.ErrorDataReceived += (_, e) =>
        {
            if (!string.IsNullOrWhiteSpace(e.Data)) CapturePublisherLine("zcy-cdp-error", e.Data);
        };
        process.Exited += (_, _) =>
        {
            var exitCode = -1;
            try { exitCode = process.ExitCode; } catch { }
            try { if (File.Exists(payloadPath)) File.Delete(payloadPath); } catch { }

            string tail;
            lock (outputLock)
            {
                tail = string.Join(Environment.NewLine, outputLines.TakeLast(6));
            }

            try
            {
                BeginInvoke(() =>
                {
                    if (exitCode == 0)
                    {
                        SetStatus("政采云发布流程执行完成");
                    }
                    else
                    {
                        var message = string.IsNullOrWhiteSpace(tail)
                            ? $"政采云发布自动化失败，退出码 {exitCode}。详情见 desktop-read.log。"
                            : $"政采云发布自动化失败：{Environment.NewLine}{tail}";
                        ShowError(message);
                        SetStatus("政采云发布失败");
                    }
                });
            }
            catch
            {
                // Form may already be closing.
            }
            finally
            {
                process.Dispose();
            }
        };

        if (!process.Start())
        {
            ShowError("政采云 Playwright 发布脚本启动失败");
            return;
        }

        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
    }

    private static string? NormalizeUrl(string rawUrl)
    {
        var value = rawUrl.Trim();
        if (string.IsNullOrWhiteSpace(value)) return null;
        if (!value.Contains('.') && !value.StartsWith("localhost", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }
        if (!value.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
            !value.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            value = "https://" + value;
        }

        return Uri.TryCreate(value, UriKind.Absolute, out var uri) ? uri.ToString() : null;
    }

    private static string FormatHttpError(string body)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            var error = root.TryGetProperty("error", out var errorProp) ? errorProp.GetString() : null;
            var details = root.TryGetProperty("details", out var detailsProp) ? detailsProp.GetString() : null;
            var message = string.IsNullOrWhiteSpace(details) ? error : $"{error} - {details}";
            if (!string.IsNullOrWhiteSpace(message))
            {
                return message.Length > 300 ? message[..300] + "..." : message;
            }
        }
        catch
        {
            // Fall through to plain text truncation.
        }

        var compact = Regex.Replace(body, @"\s+", " ").Trim();
        return compact.Length > 300 ? compact[..300] + "..." : compact;
    }

    private async Task ReadCurrentJdAsync()
    {
        var currentUrl = browserView.Source?.ToString() ?? "";
        LogDesktopRead($"read-click url={currentUrl}");
        if (!currentUrl.Contains("jd.com", StringComparison.OrdinalIgnoreCase))
        {
            ShowError("当前工作台不是京东页面，请先在右侧打开京东商品页。");
            return;
        }

        var token = await GetAppTokenAsync();
        LogDesktopRead($"token-present={!string.IsNullOrWhiteSpace(token)}");
        if (string.IsNullOrWhiteSpace(token))
        {
            SetStatus("左侧登录令牌未读取到，开发环境将使用测试账号保存。");
        }

        SetStatus("正在读取当前京东商品...");
        using var client = new HttpClient { Timeout = TimeSpan.FromMinutes(4) };
        if (!string.IsNullOrWhiteSpace(token))
        {
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }

        JsonElement productData;
        try
        {
            productData = await ReadJdProductFromWorkbenchAsync();
            var title = productData.TryGetProperty("title", out var titleProp) ? titleProp.GetString() : "";
            var imageCount = productData.TryGetProperty("images", out var imagesProp) && imagesProp.ValueKind == JsonValueKind.Array
                ? imagesProp.GetArrayLength()
                : 0;
            var detailCount = productData.TryGetProperty("detailImages", out var detailImagesProp) && detailImagesProp.ValueKind == JsonValueKind.Array
                ? detailImagesProp.GetArrayLength()
                : 0;
            var specGroupCount = productData.TryGetProperty("skuData", out var skuDataProp)
                && skuDataProp.ValueKind == JsonValueKind.Object
                && skuDataProp.TryGetProperty("specGroups", out var specGroupsProp)
                && specGroupsProp.ValueKind == JsonValueKind.Array
                    ? specGroupsProp.GetArrayLength()
                    : 0;
            LogDesktopRead($"read-result title={title} mainImages={imageCount} detailImages={detailCount} specGroups={specGroupCount}");
        }
        catch (Exception error)
        {
            LogDesktopRead($"read-error {error}");
            ShowError($"页面读取失败：{error.Message}");
            return;
        }
        var payload = JsonSerializer.Serialize(new { url = currentUrl, productData });
        using var content = new StringContent(payload, Encoding.UTF8, "application/json");
        using var res = await client.PostAsync($"{BackendUrl}/api/copy/jd/import", content);
        var body = await res.Content.ReadAsStringAsync();
        LogDesktopRead($"import-response status={(int)res.StatusCode} body={body}");
        if (!res.IsSuccessStatusCode)
        {
            ShowError($"Save failed: {FormatHttpError(body)}");
            return;
        }

        SetStatus("已保存到任务中心");
        await NavigateAppViewAsync($"{BackendUrl}/dashboard/tasks");
    }

    private async Task ReadNativeJdAsync()
    {
        var pastedUrl = nativeJdUrlBox.Text.Trim();
        if (!string.IsNullOrWhiteSpace(pastedUrl))
        {
            var url = NormalizeUrl(pastedUrl);
            if (url is null || !url.Contains("jd.com", StringComparison.OrdinalIgnoreCase))
            {
                ShowError("请输入有效的京东商品链接");
                return;
            }

            workTabs.SelectedIndex = 0;
            addressBox.Text = url;
            SetStatus("正在打开京东商品页...");
            await NavigateBrowserAndWaitAsync(browserView, url);
        }

        await ReadCurrentJdAsync();
    }

    private async Task NavigateBrowserAndWaitAsync(WebView2 view, string url)
    {
        var completion = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        void Handler(object? sender, CoreWebView2NavigationCompletedEventArgs args) => completion.TrySetResult(true);

        view.CoreWebView2.NavigationCompleted += Handler;
        try
        {
            view.CoreWebView2.Navigate(url);
            await Task.WhenAny(completion.Task, Task.Delay(TimeSpan.FromSeconds(20)));
        }
        finally
        {
            view.CoreWebView2.NavigationCompleted -= Handler;
        }
    }

    private async Task<JsonElement> ReadJdProductFromWorkbenchAsync()
    {
        var currentUrl = browserView.Source?.ToString() ?? "";
        var productId = ExtractJdProductId(currentUrl);
        var captureId = $"{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}-{Guid.NewGuid():N}";
        BeginJdCapture(captureId, productId, currentUrl);
        LogDesktopRead($"jd-capture-start captureId={captureId} productId={productId} url={currentUrl}");
        const string prepareScript = """
            (async () => {
              const captureId = window.__gravopsCapture?.captureId || '';
              window.__gravopsActiveCaptureId = captureId;
              window.__gravopsDetailPrepareDone = '';
              window.__gravopsDetailNetworkImages = [];
              window.__gravopsDetailHtmlCandidates = [];
              window.__gravopsDetailDomImages = [];
              window.__gravopsMainImages = [];
              const clean = (value) => String(value || '').trim().replace(/\s+/g, '');
              const originalY = window.scrollY || 0;
              const detailSelectors = ['#graphic-content', '#J-detail-content', '#detail', '.detail-content', '.ssd-module-detail', '.ssd-module-wrap', '.ssd-module', '.p-parameter', '.detail'];
              const stats = () => {
                const containers = detailSelectors.map((selector) => document.querySelector(selector)).filter(Boolean);
                const htmlLength = containers.reduce((sum, node) => sum + String(node.innerHTML || '').length, 0);
                const height = containers.reduce((sum, node) => sum + (node.offsetHeight || 0), 0);
                const imageCount = containers.reduce((sum, node) => sum + node.querySelectorAll('img, source, [style*="url("]').length, 0);
                return { htmlLength, height, imageCount };
              };
              const thumbs = Array.from(document.querySelectorAll('#spec-list li, .spec-items li, .lh li')).slice(0, 12);
              for (const thumb of thumbs) {
                thumb.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
                thumb.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                await new Promise((resolve) => setTimeout(resolve, 160));
              }

              const findDetailTabs = () => Array.from(document.querySelectorAll('li, a, span, div, button'))
                .map((node) => {
                  const rect = node.getBoundingClientRect();
                  return { node, rect, text: clean(node.textContent) };
                })
                .filter(({ node, rect, text }) => {
                  if (!(node instanceof HTMLElement)) return false;
                  if (!(text === '\u5546\u54c1\u8be6\u60c5' || text === '\u8be6\u60c5' || (text.includes('\u5546\u54c1\u8be6\u60c5') && text.length <= 16))) return false;
                  if (rect.width < 20 || rect.height < 10) return false;
                  return true;
                })
                .sort((a, b) => Math.abs(a.rect.top - 760) - Math.abs(b.rect.top - 760))
                .map((item) => item.node);

              for (const tab of findDetailTabs().slice(0, 3)) {
                tab.scrollIntoView({ block: 'center' });
                await new Promise((resolve) => setTimeout(resolve, 300));
                tab.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
                tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                tab.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                tab.click();
                window.__gravopsDetailClickedAt = Date.now();
                await new Promise((resolve) => setTimeout(resolve, 700));
              }
              let previous = stats();
              let stableSince = Date.now();
              const startedAt = Date.now();
              for (let i = 0; i < 18 && Date.now() - startedAt < 12000; i++) {
                window.scrollBy(0, 900);
                await new Promise((resolve) => setTimeout(resolve, 420));
                const current = stats();
                const changed = current.htmlLength !== previous.htmlLength || current.imageCount !== previous.imageCount || Math.abs(current.height - previous.height) > 80;
                if (changed) {
                  stableSince = Date.now();
                  previous = current;
                }
                const enoughDom = current.imageCount > 0 || current.height > 500 || current.htmlLength > 3000;
                if (enoughDom && Date.now() - stableSince >= 800) break;
              }
              window.scrollTo(0, originalY);
              await new Promise((resolve) => setTimeout(resolve, 200));
              window.__gravopsDetailPrepareDone = captureId;
              return true;
            })()
            """;
        var captureJson = JsonSerializer.Serialize(new
        {
            captureId,
            productId,
            skuId = productId,
            pageUrl = currentUrl,
            timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        });
        await browserView.CoreWebView2.ExecuteScriptAsync($"window.__gravopsCapture = {captureJson};");
        await browserView.CoreWebView2.ExecuteScriptAsync("""
            window.__gravopsDetailNetworkImages = [];
            window.__gravopsDetailHtmlCandidates = [];
            window.__gravopsDetailDomImages = [];
            window.__gravopsMainImages = [];
            window.__gravopsDetailCaptures = [];
            window.__gravopsDetailClickedAt = 0;
            window.__gravopsDetailPrepareDone = '';
            """);
        await browserView.CoreWebView2.ExecuteScriptAsync(prepareScript);
        var prepareDeadline = DateTime.UtcNow.AddSeconds(13);
        while (DateTime.UtcNow < prepareDeadline)
        {
            var doneJson = await browserView.CoreWebView2.ExecuteScriptAsync("window.__gravopsDetailPrepareDone || ''");
            var doneCaptureId = JsonSerializer.Deserialize<string>(doneJson) ?? "";
            if (doneCaptureId == captureId) break;
            await Task.Delay(250);
        }
        var detailClickedAtJson = await browserView.CoreWebView2.ExecuteScriptAsync("window.__gravopsDetailClickedAt || 0");
        var detailClickedAt = ParseScriptInt64(detailClickedAtJson);
        var detailNetworkImages = SnapshotJdImageResponses(captureId);
        var detailNetworkCaptures = SnapshotJdNetworkCaptures(captureId);
        LogDesktopRead($"detail-network-candidates captureId={captureId} detailClickedAt={detailClickedAt} images={detailNetworkImages.Count} captures={detailNetworkCaptures.Count}");

        var repoRoot = FindRepoRoot();
        var scriptPath = Path.Combine(repoRoot, "gravops-desktop-shell", "Scripts", "jd-webview-reader.js");
        if (!File.Exists(scriptPath))
        {
            throw new FileNotFoundException("JD WebView reader script not found", scriptPath);
        }

        var detailNetworkJson = JsonSerializer.Serialize(detailNetworkImages);
        var detailCaptureJson = JsonSerializer.Serialize(detailNetworkCaptures);
        await browserView.CoreWebView2.ExecuteScriptAsync($"window.__gravopsDetailNetworkImages = {detailNetworkJson};");
        await browserView.CoreWebView2.ExecuteScriptAsync($"window.__gravopsDetailCaptures = {detailCaptureJson};");
        await browserView.CoreWebView2.ExecuteScriptAsync($"window.__gravopsDetailClickedAt = {detailClickedAt};");
        var resultJson = await browserView.CoreWebView2.ExecuteScriptAsync(await File.ReadAllTextAsync(scriptPath));
        LogDesktopRead($"script-return-prefix={resultJson[..Math.Min(resultJson.Length, 500)]}");
        using var doc = JsonDocument.Parse(resultJson);
        var product = doc.RootElement.Clone();
        var title = product.TryGetProperty("title", out var titleProp) ? titleProp.GetString() : "";
        var imageCount = product.TryGetProperty("images", out var imagesProp) && imagesProp.ValueKind == JsonValueKind.Array
            ? imagesProp.GetArrayLength()
            : 0;
        var detailCount = product.TryGetProperty("detailImages", out var detailImagesProp) && detailImagesProp.ValueKind == JsonValueKind.Array
            ? detailImagesProp.GetArrayLength()
            : 0;
        LogJdDetailDebug(product);
        if (product.TryGetProperty("debug", out var debug)
            && debug.TryGetProperty("consistencyOk", out var consistencyOk)
            && consistencyOk.ValueKind == JsonValueKind.False)
        {
            throw new InvalidOperationException("当前页面商品状态不一致，已拒绝采集详情图，避免上传错商品图片。");
        }
        if (detailCount == 0)
        {
            LogDesktopRead("webview-read detailImages=0; skipped external CDP fallback");
        }
        var attributeCount = product.TryGetProperty("attributes", out var attributesProp) && attributesProp.ValueKind == JsonValueKind.Object
            ? attributesProp.EnumerateObject().Count()
            : 0;
        if (string.IsNullOrWhiteSpace(title) || (imageCount == 0 && detailCount == 0))
        {
            throw new InvalidOperationException($"当前页没有读到完整商品信息：title={(!string.IsNullOrWhiteSpace(title))}, mainImages={imageCount}, detailImages={detailCount}, attributes={attributeCount}");
        }
        return product;
    }

    private void LogJdDetailDebug(JsonElement product)
    {
        if (!product.TryGetProperty("debug", out var debug) || debug.ValueKind != JsonValueKind.Object)
        {
            LogDesktopRead("jd-detail-debug missing");
            return;
        }

        string GetString(string name) => debug.TryGetProperty(name, out var value) ? value.ToString() : "";
        LogDesktopRead(
            "jd-detail-summary "
            + $"captureId={GetString("captureId")} "
            + $"url={GetString("currentUrl")} "
            + $"productId={GetString("productId")} "
            + $"sku={GetString("skuId")} "
            + $"itemNo={GetString("itemNo")} "
            + $"model={GetString("model")} "
            + $"title={GetString("title")} "
            + $"main={GetString("mainImageCount")} "
            + $"detailHtml={GetString("detailHtmlImageCount")} "
            + $"detailDom={GetString("detailDomImageCount")} "
            + $"network={GetString("networkImageCount")} "
            + $"trusted={GetString("trustedDetailCandidateCount")} "
            + $"networkFallback={GetString("networkFallbackUsed")} "
            + $"final={GetString("finalDetailImageCount")} "
            + $"filtered={GetString("filteredImageCount")}"
        );

        if (debug.TryGetProperty("warnings", out var warnings) && warnings.ValueKind == JsonValueKind.Array)
        {
            foreach (var warning in warnings.EnumerateArray())
            {
                LogDesktopRead($"jd-detail-warning {warning}");
            }
        }

        if (!debug.TryGetProperty("images", out var images) || images.ValueKind != JsonValueKind.Array) return;
        foreach (var image in images.EnumerateArray().Take(120))
        {
            var url = image.TryGetProperty("url", out var urlProp) ? urlProp.GetString() ?? "" : "";
            var source = image.TryGetProperty("source", out var sourceProp) ? sourceProp.GetString() ?? "" : "";
            var captureId = image.TryGetProperty("captureId", out var captureProp) ? captureProp.GetString() ?? "" : "";
            var kept = image.TryGetProperty("kept", out var keptProp) && keptProp.GetBoolean();
            var width = image.TryGetProperty("width", out var widthProp) ? widthProp.ToString() : "";
            var height = image.TryGetProperty("height", out var heightProp) ? heightProp.ToString() : "";
            var timestamp = image.TryGetProperty("timestamp", out var timestampProp) ? timestampProp.ToString() : "";
            var isCurrentProduct = image.TryGetProperty("isCurrentProduct", out var currentProp) ? currentProp.ToString() : "";
            var isAfterDetailClick = image.TryGetProperty("isAfterDetailClick", out var afterProp) ? afterProp.ToString() : "";
            var reasons = image.TryGetProperty("filterReason", out var reasonProp) && reasonProp.ValueKind == JsonValueKind.Array
                ? string.Join("|", reasonProp.EnumerateArray().Select((item) => item.ToString()))
                : "";
            var rules = image.TryGetProperty("hitRules", out var ruleProp) && ruleProp.ValueKind == JsonValueKind.Array
                ? string.Join("|", ruleProp.EnumerateArray().Select((item) => item.ToString()))
                : "";
            LogDesktopRead($"jd-detail-image captureId={captureId} kept={kept} source={source} size={width}x{height} currentProduct={isCurrentProduct} afterDetailClick={isAfterDetailClick} timestamp={timestamp} rules={rules} reason={reasons} url={url}");
        }
    }

    private static long ParseScriptInt64(string scriptJson)
    {
        try
        {
            using var doc = JsonDocument.Parse(scriptJson);
            var root = doc.RootElement;
            if (root.ValueKind == JsonValueKind.Number && root.TryGetInt64(out var number)) return number;
            if (root.ValueKind == JsonValueKind.String && long.TryParse(root.GetString(), out var parsed)) return parsed;
        }
        catch
        {
            // WebView script results can be "undefined", "null", or quoted strings depending on page state.
        }

        return 0;
    }

    private async Task<JsonElement> TryFillJdDetailImagesWithCdpAsync(JsonElement product, string currentUrl)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(currentUrl) || !currentUrl.Contains("jd.com", StringComparison.OrdinalIgnoreCase))
            {
                return product;
            }

            var repoRoot = FindRepoRoot();
            var prototypeRoot = Path.Combine(repoRoot, "zcy-desktop-prototype");
            var scriptPath = Path.Combine(prototypeRoot, "src", "collect-jd-cdp.mjs");
            if (!File.Exists(scriptPath)) return product;

            var node = OperatingSystem.IsWindows() ? "node.exe" : "node";
            var startInfo = new ProcessStartInfo
            {
                FileName = node,
                WorkingDirectory = prototypeRoot,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            };
            startInfo.ArgumentList.Add("src/collect-jd-cdp.mjs");
            startInfo.ArgumentList.Add("--url");
            startInfo.ArgumentList.Add(currentUrl);

            using var process = Process.Start(startInfo);
            if (process is null) return product;

            var stdoutTask = process.StandardOutput.ReadToEndAsync();
            var stderrTask = process.StandardError.ReadToEndAsync();
            var waitTask = process.WaitForExitAsync();
            var completed = await Task.WhenAny(waitTask, Task.Delay(TimeSpan.FromSeconds(90)));
            if (completed != waitTask)
            {
                try { process.Kill(entireProcessTree: true); } catch { }
                LogDesktopRead("cdp-detail-merge timeout");
                return product;
            }

            var stdout = await stdoutTask;
            var stderr = await stderrTask;
            if (process.ExitCode != 0)
            {
                LogDesktopRead($"cdp-detail-merge error={stderr[..Math.Min(stderr.Length, 500)]}");
                return product;
            }

            var start = stdout.IndexOf('{');
            if (start < 0) return product;
            using var cdpDoc = JsonDocument.Parse(stdout[start..]);
            if (!TryGetDetailImages(cdpDoc.RootElement, out var detailImages) || detailImages.Count == 0)
            {
                return product;
            }

            var merged = JsonNode.Parse(product.GetRawText()) as JsonObject;
            if (merged is null) return product;
            var detailArray = new JsonArray(detailImages.Select((item) => JsonValue.Create(item)).ToArray<JsonNode?>());
            merged["detailImages"] = detailArray;
            merged["detailHtml"] = string.Join("\n", detailImages.Select((src) => $"<p><img src=\"{src.Replace("\"", "&quot;")}\" style=\"max-width:100%;\" /></p>"));

            using var mergedDoc = JsonDocument.Parse(merged.ToJsonString());
            return mergedDoc.RootElement.Clone();
        }
        catch (Exception error)
        {
            LogDesktopRead($"cdp-detail-merge exception={error.Message}");
            return product;
        }
    }

    private static bool TryGetDetailImages(JsonElement root, out List<string> detailImages)
    {
        detailImages = new List<string>();
        if (root.TryGetProperty("scrapedData", out var scrapedData)
            && scrapedData.TryGetProperty("detailImages", out var scrapedDetailImages)
            && scrapedDetailImages.ValueKind == JsonValueKind.Array)
        {
            detailImages = scrapedDetailImages.EnumerateArray()
                .Select((item) => item.GetString() ?? "")
                .Where((item) => !string.IsNullOrWhiteSpace(item))
                .Distinct()
                .ToList();
            return detailImages.Count > 0;
        }

        if (root.TryGetProperty("product", out var product)
            && product.TryGetProperty("detailImages", out var productDetailImages)
            && productDetailImages.ValueKind == JsonValueKind.Array)
        {
            detailImages = productDetailImages.EnumerateArray()
                .Select((item) => item.GetString() ?? "")
                .Where((item) => !string.IsNullOrWhiteSpace(item))
                .Distinct()
                .ToList();
            return detailImages.Count > 0;
        }

        return false;
    }

    private void ClearJdImageResponses()
    {
        lock (jdImageResponseLock)
        {
            jdImageResponses.Clear();
        }
    }

    private List<string> SnapshotJdImageResponses(string captureId)
    {
        lock (jdNetworkCaptureLock)
        {
            return jdNetworkCaptures
                .Where((item) => item.CaptureId == captureId && item.Source == "network_image")
                .Select((item) => item.Url)
                .Where((item) => !string.IsNullOrWhiteSpace(item))
                .Distinct()
                .ToList();
        }
    }

    private void ClearJdNetworkCaptures()
    {
        ClearJdImageResponses();
        lock (jdNetworkCaptureLock)
        {
            activeJdCaptureId = null;
            activeJdCaptureProductId = null;
            activeJdCapturePageUrl = null;
            jdNetworkCaptures.Clear();
            jdNetworkCaptureSeq = 0;
        }
    }

    private void BeginJdCapture(string captureId, string productId, string pageUrl)
    {
        lock (jdNetworkCaptureLock)
        {
            activeJdCaptureId = captureId;
            activeJdCaptureProductId = productId;
            activeJdCapturePageUrl = pageUrl;
            jdNetworkCaptures.Clear();
            jdNetworkCaptureSeq = 0;
        }
        ClearJdImageResponses();
    }

    private static string ExtractJdProductId(string? rawUrl)
    {
        if (string.IsNullOrWhiteSpace(rawUrl)) return "";
        var match = Regex.Match(rawUrl, @"item\.jd\.com/(\d+)\.html", RegexOptions.IgnoreCase);
        return match.Success ? match.Groups[1].Value : "";
    }

    private List<JdNetworkCapture> SnapshotJdNetworkCaptures(string captureId)
    {
        lock (jdNetworkCaptureLock)
        {
            return jdNetworkCaptures
                .Where((item) => item.CaptureId == captureId)
                .Select((item) => new JdNetworkCapture
                {
                    Seq = item.Seq,
                    Url = item.Url,
                    Kind = item.Kind,
                    Source = item.Source,
                    ContentType = item.ContentType,
                    Body = item.Body,
                    CaptureId = item.CaptureId,
                    ProductId = item.ProductId,
                    SkuId = item.SkuId,
                    PageUrl = item.PageUrl,
                    Timestamp = item.Timestamp
                })
                .ToList();
        }
    }

    private async Task CaptureJdNetworkResponseAsync(CoreWebView2WebResourceResponseReceivedEventArgs e)
    {
        try
        {
            var uri = e.Request.Uri;
            var contentType = e.Response.Headers.GetHeader("content-type") ?? "";
            var kind = InferJdResourceKind(uri, contentType);
            if (!IsJdCaptureScope(uri)) return;
            string captureId;
            string productId;
            string pageUrl;
            lock (jdNetworkCaptureLock)
            {
                captureId = activeJdCaptureId ?? "";
                productId = activeJdCaptureProductId ?? "";
                pageUrl = activeJdCapturePageUrl ?? "";
            }
            if (string.IsNullOrWhiteSpace(captureId)) return;

            if (IsJdImageResponseCandidate(uri))
            {
                AddJdNetworkCapture(new JdNetworkCapture
                {
                    Url = uri,
                    Kind = kind,
                    Source = "network_image",
                    ContentType = "image",
                    CaptureId = captureId,
                    ProductId = productId,
                    SkuId = productId,
                    PageUrl = pageUrl,
                    Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
                });

                lock (jdImageResponseLock)
                {
                    if (!jdImageResponses.Contains(uri))
                    {
                        jdImageResponses.Add(uri);
                        if (jdImageResponses.Count > 500)
                        {
                            jdImageResponses.RemoveRange(0, jdImageResponses.Count - 500);
                        }
                    }
                }
                return;
            }

            if (!ShouldReadJdResponseBody(uri, kind, contentType)) return;

            using var stream = await e.Response.GetContentAsync();
            if (stream is null || !stream.CanRead) return;
            using var reader = new StreamReader(stream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true, leaveOpen: false);
            var body = await ReadLimitedAsync(reader, 1_500_000);
            if (!IsLikelyJdDetailBody(body)) return;

            AddJdNetworkCapture(new JdNetworkCapture
            {
                Url = uri,
                Kind = kind,
                Source = "detail_html",
                ContentType = contentType,
                Body = body,
                CaptureId = captureId,
                ProductId = productId,
                SkuId = productId,
                PageUrl = pageUrl,
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            });
        }
        catch (Exception error)
        {
            LogDesktopRead($"network-capture-error {error.Message}");
        }
    }

    private void AddJdNetworkCapture(JdNetworkCapture capture)
    {
        lock (jdNetworkCaptureLock)
        {
            if (string.IsNullOrWhiteSpace(capture.CaptureId) || capture.CaptureId != activeJdCaptureId)
            {
                return;
            }
            capture.Seq = ++jdNetworkCaptureSeq;
            jdNetworkCaptures.Add(capture);
            if (jdNetworkCaptures.Count > 300)
            {
                jdNetworkCaptures.RemoveRange(0, jdNetworkCaptures.Count - 300);
            }
        }
    }

    private static async Task<string> ReadLimitedAsync(StreamReader reader, int maxChars)
    {
        var buffer = new char[Math.Min(8192, maxChars)];
        var builder = new StringBuilder();
        while (builder.Length < maxChars)
        {
            var read = await reader.ReadAsync(buffer, 0, Math.Min(buffer.Length, maxChars - builder.Length));
            if (read <= 0) break;
            builder.Append(buffer, 0, read);
        }
        return builder.ToString();
    }

    private static bool IsJdCaptureScope(string? rawUrl)
    {
        if (!Uri.TryCreate(rawUrl, UriKind.Absolute, out var uri)) return false;
        var host = uri.Host.ToLowerInvariant();
        if (host.EndsWith("jd.com") || host.EndsWith("360buyimg.com") || host.EndsWith("jd.hk")) return true;
        return rawUrl.Contains("jfs", StringComparison.OrdinalIgnoreCase)
            || rawUrl.Contains("pcpubliccms", StringComparison.OrdinalIgnoreCase);
    }

    private static bool ShouldReadJdResponseBody(string url, string kind, string contentType)
    {
        if (kind.Equals("Image", StringComparison.OrdinalIgnoreCase)) return false;
        if (kind.Equals("XmlHttpRequest", StringComparison.OrdinalIgnoreCase)
            || kind.Equals("Fetch", StringComparison.OrdinalIgnoreCase)
            || kind.Equals("Script", StringComparison.OrdinalIgnoreCase)
            || kind.Equals("Document", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        var lowerType = contentType.ToLowerInvariant();
        if (lowerType.Contains("html") || lowerType.Contains("json") || lowerType.Contains("javascript") || lowerType.Contains("text")) return true;
        return Regex.IsMatch(url, "detail|desc|description|graphic|content|ssd", RegexOptions.IgnoreCase);
    }

    private static string InferJdResourceKind(string url, string contentType)
    {
        var lowerUrl = url.ToLowerInvariant();
        var lowerType = contentType.ToLowerInvariant();
        if (Regex.IsMatch(lowerUrl, "\\.(jpg|jpeg|png|gif)(?:$|[?#])") || lowerType.StartsWith("image/")) return "Image";
        if (lowerType.Contains("html")) return "Document";
        if (lowerType.Contains("json")) return "XmlHttpRequest";
        if (lowerType.Contains("javascript") || Regex.IsMatch(lowerUrl, "\\.js(?:$|[?#])")) return "Script";
        if (lowerType.Contains("text")) return "Text";
        if (Regex.IsMatch(lowerUrl, "detail|desc|description|graphic|content|ssd", RegexOptions.IgnoreCase)) return "XmlHttpRequest";
        return "Other";
    }

    private static bool IsLikelyJdDetailBody(string body)
    {
        if (string.IsNullOrWhiteSpace(body)) return false;
        if (!Regex.IsMatch(body, "360buyimg\\.com|jfs|pcpubliccms", RegexOptions.IgnoreCase)) return false;
        return Regex.IsMatch(body, "ssd-module|detail|description|商品详情|graphic|content", RegexOptions.IgnoreCase);
    }

    private static bool IsJdImageResponseCandidate(string? rawUrl)
    {
        if (!Uri.TryCreate(rawUrl, UriKind.Absolute, out var uri)) return false;
        if (!uri.Host.EndsWith("360buyimg.com", StringComparison.OrdinalIgnoreCase)) return false;
        var path = uri.AbsolutePath.ToLowerInvariant();
        if (!path.EndsWith(".jpg") && !path.EndsWith(".jpeg") && !path.EndsWith(".png") && !path.EndsWith(".gif")) return false;
        return path.Contains("/sku/jfs/")
            || path.Contains("/imgzone/jfs/")
            || path.Contains("/img/jfs/")
            || path.Contains("/popwatermark/")
            || path.Contains("/pcpubliccms/")
            || path.Contains("/jfs/")
            || path.Contains("/s") && path.Contains("_jfs/");
    }

    private async Task<string> GetAppTokenAsync()
    {
        try
        {
            await EnsureAppOriginAsync();
            var json = await appView.CoreWebView2.ExecuteScriptAsync("localStorage.getItem('token') || ''");
            return JsonSerializer.Deserialize<string>(json) ?? "";
        }
        catch (Exception error)
        {
            LogDesktopRead($"token-read-error: {error.Message}");
            return "";
        }
    }

    private async Task EnsureAppOriginAsync()
    {
        var source = appView.Source?.ToString() ?? "";
        if (source.StartsWith(BackendUrl, StringComparison.OrdinalIgnoreCase)) return;
        await NavigateAppViewAsync($"{BackendUrl}/dashboard/tasks");
    }

    private async Task NavigateAppViewAsync(string url)
    {
        SetAppViewLoading(true);
        var completion = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        void Handler(object? sender, CoreWebView2NavigationCompletedEventArgs args) => completion.TrySetResult(true);

        appView.CoreWebView2.NavigationCompleted += Handler;
        try
        {
            appView.CoreWebView2.Navigate(url);
            await Task.WhenAny(completion.Task, Task.Delay(TimeSpan.FromSeconds(10)));
            await ApplyDesktopAppChromeAsync();
            await Task.Delay(80);
        }
        finally
        {
            appView.CoreWebView2.NavigationCompleted -= Handler;
            SetAppViewLoading(false);
        }
    }

    private async Task RefreshNativeTasksAsync()
    {
        nativeRefreshButton.Enabled = false;
        nativeMessageLabel.Text = "正在刷新任务...";
        try
        {
            var token = await GetAppTokenAsync();
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(20) };
            if (!string.IsNullOrWhiteSpace(token))
            {
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
            }

            using var res = await client.GetAsync($"{BackendUrl}/api/copy/drafts");
            var body = await res.Content.ReadAsStringAsync();
            if (!res.IsSuccessStatusCode)
            {
                nativeMessageLabel.Text = $"刷新失败：{FormatHttpError(body)}";
                return;
            }

            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            if (!root.TryGetProperty("drafts", out var draftsProp) || draftsProp.ValueKind != JsonValueKind.Array)
            {
                nativeMessageLabel.Text = "刷新失败：任务数据格式不正确";
                return;
            }

            nativeDrafts.Clear();
            foreach (var draftProp in draftsProp.EnumerateArray())
            {
                nativeDrafts.Add(ParseNativeDraft(draftProp));
            }

            RenderNativeTasks();
            nativeMessageLabel.Text = $"已刷新 {nativeDrafts.Count} 个商品";
        }
        catch (Exception error)
        {
            LogDesktopRead($"native-refresh-error: {error}");
            nativeMessageLabel.Text = $"刷新失败：{error.Message}";
        }
        finally
        {
            nativeRefreshButton.Enabled = true;
        }
    }

    private NativeDraft ParseNativeDraft(JsonElement draft)
    {
        return new NativeDraft
        {
            Id = ReadString(draft, "id"),
            Title = ReadString(draft, "title"),
            OriginalUrl = ReadString(draft, "originalUrl"),
            Brand = ReadString(draft, "brand"),
            Model = ReadString(draft, "model"),
            Status = ReadString(draft, "status"),
            CategoryPath = ReadCategoryPath(draft),
            Price = ReadString(draft, "price"),
            MarketPrice = ReadString(draft, "marketPrice"),
            MainImageCount = CountArrayLike(draft, "images"),
            DetailImageCount = CountArrayLike(draft, "detailImages")
        };
    }

    private static string ReadString(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var prop)) return "";
        return prop.ValueKind switch
        {
            JsonValueKind.String => prop.GetString() ?? "",
            JsonValueKind.Number => prop.GetRawText(),
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            _ => ""
        };
    }

    private static string ReadCategoryPath(JsonElement draft)
    {
        if (!draft.TryGetProperty("categoryPath", out var prop)) return "";
        if (prop.ValueKind == JsonValueKind.Array)
        {
            return string.Join(" > ", prop.EnumerateArray().Select(item => item.GetString()).Where(value => !string.IsNullOrWhiteSpace(value)));
        }

        var raw = ReadString(draft, "categoryPath");
        if (string.IsNullOrWhiteSpace(raw)) return "";
        try
        {
            using var doc = JsonDocument.Parse(raw);
            if (doc.RootElement.ValueKind == JsonValueKind.Array)
            {
                return string.Join(" > ", doc.RootElement.EnumerateArray().Select(item => item.GetString()).Where(value => !string.IsNullOrWhiteSpace(value)));
            }
            if (doc.RootElement.ValueKind == JsonValueKind.String)
            {
                return doc.RootElement.GetString() ?? raw;
            }
        }
        catch
        {
            // Stored category can also be plain text.
        }

        return raw;
    }

    private static int CountArrayLike(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var prop)) return 0;
        if (prop.ValueKind == JsonValueKind.Array) return prop.GetArrayLength();

        if (prop.ValueKind == JsonValueKind.String)
        {
            var raw = prop.GetString();
            if (string.IsNullOrWhiteSpace(raw)) return 0;
            try
            {
                using var doc = JsonDocument.Parse(raw);
                return doc.RootElement.ValueKind == JsonValueKind.Array ? doc.RootElement.GetArrayLength() : 0;
            }
            catch
            {
                return 0;
            }
        }

        return 0;
    }

    private void RenderNativeTasks()
    {
        var keyword = nativeSearchBox.Text.Trim();
        var visibleDrafts = nativeDrafts
            .Where(draft => string.IsNullOrWhiteSpace(keyword)
                || draft.Title.Contains(keyword, StringComparison.OrdinalIgnoreCase)
                || draft.Brand.Contains(keyword, StringComparison.OrdinalIgnoreCase)
                || draft.Model.Contains(keyword, StringComparison.OrdinalIgnoreCase))
            .ToList();

        nativeTaskList.BeginUpdate();
        nativeTaskList.Items.Clear();
        foreach (var draft in visibleDrafts)
        {
            var title = string.IsNullOrWhiteSpace(draft.Title) ? "未命名商品" : draft.Title;
            if (title.Length > 34) title = title[..34] + "...";
            var item = new ListViewItem(title) { Tag = draft };
            item.SubItems.Add(StatusText(draft.Status));
            item.SubItems.Add($"{draft.MainImageCount}/{draft.DetailImageCount}");
            if (draft.NeedsReview)
            {
                item.ForeColor = Color.FromArgb(71, 85, 105);
                item.BackColor = Color.FromArgb(255, 251, 235);
            }
            else
            {
                item.ForeColor = Color.FromArgb(15, 23, 42);
            }
            nativeTaskList.Items.Add(item);
        }
        nativeTaskList.EndUpdate();

        var readyCount = nativeDrafts.Count(draft => !draft.NeedsReview);
        var reviewCount = nativeDrafts.Count(draft => draft.NeedsReview);
        var publishedCount = nativeDrafts.Count(draft => string.Equals(draft.Status, "published", StringComparison.OrdinalIgnoreCase));
        nativeStatsLabel.Text = $"全部 {nativeDrafts.Count} | 可发布 {readyCount} | 待补充 {reviewCount} | 已发布 {publishedCount}";
        UpdateNativeDetailPanel();
    }

    private static string StatusText(string status)
    {
        return status.ToLowerInvariant() switch
        {
            "publishing" => "发布中",
            "published" => "已发布",
            "failed" => "失败",
            "scraped" => "已采集",
            "collected" => "已采集",
            "pending" => "待处理",
            _ => string.IsNullOrWhiteSpace(status) ? "待处理" : status
        };
    }

    private void UpdateNativeDetailPanel()
    {
        var draft = nativeTaskList.SelectedItems.Count > 0 ? nativeTaskList.SelectedItems[0].Tag as NativeDraft : null;
        nativePublishButton.Enabled = draft is not null;
        if (draft is null)
        {
            nativeDetailLabel.Text = "选择一个商品查看确认信息";
            return;
        }

        var reviewText = draft.NeedsReview ? "需要检查价格/类目/图片等信息" : "信息完整，可以发布";
        nativeDetailLabel.Text =
            $"商品：{draft.Title}\r\n" +
            $"品牌/型号：{draft.Brand} / {draft.Model}\r\n" +
            $"类目：{draft.CategoryPath}\r\n" +
            $"价格：{draft.Price} / {draft.MarketPrice}    图片：{draft.MainImageCount} 主图，{draft.DetailImageCount} 详情图\r\n" +
            $"状态：{StatusText(draft.Status)}，{reviewText}";
    }

    private async Task PublishSelectedNativeDraftAsync()
    {
        var draft = nativeTaskList.SelectedItems.Count > 0 ? nativeTaskList.SelectedItems[0].Tag as NativeDraft : null;
        if (draft is null) return;

        nativePublishButton.Enabled = false;
        nativeMessageLabel.Text = "正在准备政采云发布数据...";
        try
        {
            var token = await GetAppTokenAsync();
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(45) };
            if (!string.IsNullOrWhiteSpace(token))
            {
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
            }

            var requestJson = JsonSerializer.Serialize(new { draftId = draft.Id });
            using var content = new StringContent(requestJson, Encoding.UTF8, "application/json");
            using var res = await client.PostAsync($"{BackendUrl}/api/publish", content);
            var body = await res.Content.ReadAsStringAsync();
            if (!res.IsSuccessStatusCode)
            {
                nativeMessageLabel.Text = $"发布准备失败：{FormatHttpError(body)}";
                return;
            }

            var root = JsonNode.Parse(body)?.AsObject();
            var publishData = root?["publishData"]?.AsObject();
            var product = publishData?["product"]?.AsObject();
            var zcyUrl = publishData?["zcyUrl"]?.GetValue<string>();
            if (product is null || string.IsNullOrWhiteSpace(zcyUrl))
            {
                nativeMessageLabel.Text = "发布准备失败：后端没有返回完整发布数据";
                return;
            }

            product["draftId"] = publishData?["draftId"]?.DeepClone();
            product["zcyUrl"] = publishData?["zcyUrl"]?.DeepClone();
            product["template"] = publishData?["template"]?.DeepClone();
            pendingZcyPublishJson = product.ToJsonString();
            workTabs.SelectedIndex = 1;
            zcyView.CoreWebView2.Navigate(zcyUrl);
            addressBox.Text = zcyUrl;
            nativeMessageLabel.Text = "已打开政采云，正在启动自动填写...";
            SetStatus("正在启动政采云发布流程...");
            await RefreshNativeTasksAsync();
        }
        catch (Exception error)
        {
            LogDesktopRead($"native-publish-error: {error}");
            nativeMessageLabel.Text = $"发布准备失败：{error.Message}";
        }
        finally
        {
            nativePublishButton.Enabled = nativeTaskList.SelectedItems.Count > 0;
        }
    }

    private async Task OpenTaskCenterAsync()
    {
        await NavigateAppViewAsync($"{BackendUrl}/dashboard/tasks");
    }

    private WebView2 GetActiveWorkbench()
    {
        return workTabs.SelectedIndex == 1 ? zcyView : browserView;
    }

    private async Task GoBackAsync()
    {
        var active = GetActiveWorkbench();
        if (active.CoreWebView2.CanGoBack) active.CoreWebView2.GoBack();
        await Task.CompletedTask;
    }

    private async Task GoForwardAsync()
    {
        var active = GetActiveWorkbench();
        if (active.CoreWebView2.CanGoForward) active.CoreWebView2.GoForward();
        await Task.CompletedTask;
    }

    private async Task ReloadAsync()
    {
        GetActiveWorkbench().CoreWebView2.Reload();
        await Task.CompletedTask;
    }

    private void SetStatus(string text)
    {
        if (IsDisposed) return;
        if (InvokeRequired)
        {
            BeginInvoke(new Action(() => SetStatus(text)));
            return;
        }
        statusLabel.Text = text;
    }

    private void ShowError(string text)
    {
        SetStatus(text);
        MessageBox.Show(this, text, "Gravops", MessageBoxButtons.OK, MessageBoxIcon.Warning);
    }

    private void LogDesktopRead(string text)
    {
        try
        {
            File.AppendAllText(desktopLogPath, $"{DateTime.Now:O} {text}{Environment.NewLine}", Encoding.UTF8);
        }
        catch
        {
            // Logging must never break the user flow.
        }
    }
}
