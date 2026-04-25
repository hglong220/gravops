using System.Diagnostics;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Gravops.Desktop;

public sealed class MainForm : Form
{
    private const string BackendUrl = "http://localhost:3000";
    private readonly WebView2 appView = new();
    private readonly WebView2 browserView = new();
    private readonly WebView2 zcyView = new();
    private readonly TabControl workTabs = new();
    private readonly TextBox addressBox = new();
    private readonly Label statusLabel = new();
    private Process? backendProcess;
    private readonly string desktopLogPath = Path.Combine(AppContext.BaseDirectory, "desktop-read.log");

    public MainForm()
    {
        Text = "Gravops";
        Width = 1500;
        Height = 960;
        StartPosition = FormStartPosition.CenterScreen;

        BuildLayout();
        Load += async (_, _) => await InitializeAsync();
        FormClosing += (_, _) => StopBackend();
    }

    private void BuildLayout()
    {
        var root = new SplitContainer
        {
            Dock = DockStyle.Fill,
            Orientation = Orientation.Vertical
        };
        root.HandleCreated += (_, _) =>
        {
            root.Panel1MinSize = 360;
            root.Panel2MinSize = 600;
            root.SplitterDistance = 520;
        };

        appView.Dock = DockStyle.Fill;
        root.Panel1.Controls.Add(appView);

        var rightPanel = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            RowCount = 3,
            ColumnCount = 1
        };
        rightPanel.RowStyles.Add(new RowStyle(SizeType.Absolute, 46));
        rightPanel.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        rightPanel.RowStyles.Add(new RowStyle(SizeType.Absolute, 28));

        var toolbar = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 8,
            Padding = new Padding(6, 6, 6, 4)
        };
        toolbar.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 42));
        toolbar.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 42));
        toolbar.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 42));
        toolbar.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        toolbar.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 88));
        toolbar.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 122));
        toolbar.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 122));
        toolbar.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 88));

        toolbar.Controls.Add(MakeButton("<", async () => await GoBackAsync()), 0, 0);
        toolbar.Controls.Add(MakeButton(">", async () => await GoForwardAsync()), 1, 0);
        toolbar.Controls.Add(MakeButton("R", async () => await ReloadAsync()), 2, 0);

        addressBox.Dock = DockStyle.Fill;
        addressBox.PlaceholderText = "输入京东或政采云网址";
        addressBox.KeyDown += async (_, e) =>
        {
            if (e.KeyCode == Keys.Enter)
            {
                e.SuppressKeyPress = true;
                await NavigateWorkbenchAsync(addressBox.Text);
            }
        };
        toolbar.Controls.Add(addressBox, 3, 0);

        toolbar.Controls.Add(MakeButton("打开", async () => await NavigateWorkbenchAsync(addressBox.Text)), 4, 0);
        toolbar.Controls.Add(MakeButton("读取当前商品", async () => await ReadCurrentJdAsync()), 5, 0);
        toolbar.Controls.Add(MakeButton("打开政采云", async () => await NavigateWorkbenchAsync("https://www.zcygov.cn/goods-center/goods/publish")), 6, 0);
        toolbar.Controls.Add(MakeButton("任务中心", async () => await OpenTaskCenterAsync()), 7, 0);

        browserView.Dock = DockStyle.Fill;
        zcyView.Dock = DockStyle.Fill;
        workTabs.Dock = DockStyle.Fill;

        var jdPage = new TabPage("京东");
        jdPage.Controls.Add(browserView);
        var zcyPage = new TabPage("政采云");
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

        rightPanel.Controls.Add(toolbar, 0, 0);
        rightPanel.Controls.Add(workTabs, 0, 1);
        rightPanel.Controls.Add(statusLabel, 0, 2);
        root.Panel2.Controls.Add(rightPanel);

        Controls.Add(root);
    }

    private Button MakeButton(string text, Func<Task> action)
    {
        var button = new Button
        {
            Text = text,
            Dock = DockStyle.Fill,
            Margin = new Padding(3)
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

    private async Task InitializeAsync()
    {
        SetStatus("正在启动 Gravops 后台...");
        StartBackend();

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
        await zcyView.EnsureCoreWebView2Async(
            await CoreWebView2Environment.CreateAsync(null, Path.Combine(userDataRoot, "zcy"))
        );

        appView.CoreWebView2.NewWindowRequested += (_, e) =>
        {
            e.Handled = true;
            browserView.CoreWebView2.Navigate(e.Uri);
            addressBox.Text = e.Uri;
            workTabs.SelectedIndex = 0;
        };
        browserView.CoreWebView2.NewWindowRequested += (_, e) =>
        {
            e.Handled = true;
            if (!string.IsNullOrWhiteSpace(e.Uri))
            {
                browserView.CoreWebView2.Navigate(e.Uri);
                addressBox.Text = e.Uri;
                SetStatus(e.Uri);
                workTabs.SelectedIndex = 0;
            }
        };
        zcyView.CoreWebView2.NewWindowRequested += (_, e) =>
        {
            e.Handled = true;
            if (!string.IsNullOrWhiteSpace(e.Uri))
            {
                zcyView.CoreWebView2.Navigate(e.Uri);
                addressBox.Text = e.Uri;
                SetStatus(e.Uri);
                workTabs.SelectedIndex = 1;
            }
        };
        browserView.CoreWebView2.NavigationStarting += (_, e) =>
        {
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
        zcyView.CoreWebView2.NavigationCompleted += (_, _) =>
        {
            if (workTabs.SelectedIndex == 1) addressBox.Text = zcyView.Source?.ToString() ?? addressBox.Text;
        };

        await WaitForBackendAsync();
        appView.CoreWebView2.Navigate($"{BackendUrl}/dashboard/tasks");
        browserView.CoreWebView2.Navigate("https://www.jd.com/");
        zcyView.CoreWebView2.Navigate("https://www.zcygov.cn/goods-center/goods/publish");
        SetStatus("就绪");
    }

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

    private static async Task WaitForBackendAsync()
    {
        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
        for (var i = 0; i < 90; i++)
        {
            try
            {
                using var res = await client.GetAsync(BackendUrl);
                if ((int)res.StatusCode < 500) return;
            }
            catch
            {
                await Task.Delay(500);
            }
        }

        throw new InvalidOperationException("Gravops 后台启动超时");
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
            ShowError($"保存到任务中心失败：{body}");
            return;
        }

        SetStatus("已保存到任务中心");
        appView.CoreWebView2.Navigate($"{BackendUrl}/dashboard/tasks");
    }

    private async Task<JsonElement> ReadJdProductFromWorkbenchAsync()
    {
        const string prepareScript = """
            (async () => {
              const clean = (value) => String(value || '').trim().replace(/\s+/g, '');
              const tab = Array.from(document.querySelectorAll('li, a, span, div, button')).find((node) => {
                const text = clean(node.textContent);
                return text === '\u5546\u54c1\u8be6\u60c5' || text === '\u8be6\u60c5' || text.includes('\u5546\u54c1\u8be6\u60c5');
              });
              const thumbs = Array.from(document.querySelectorAll('#spec-list li, .spec-items li, .lh li')).slice(0, 12);
              for (const thumb of thumbs) {
                thumb.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
                thumb.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                await new Promise((resolve) => setTimeout(resolve, 160));
              }
              if (tab instanceof HTMLElement) tab.click();
              await new Promise((resolve) => setTimeout(resolve, 1200));
              for (let i = 0; i < 10; i++) {
                window.scrollBy(0, 900);
                await new Promise((resolve) => setTimeout(resolve, 360));
              }
              window.scrollTo(0, 0);
              await new Promise((resolve) => setTimeout(resolve, 300));
              return true;
            })()
            """;
        await browserView.CoreWebView2.ExecuteScriptAsync(prepareScript);

        var repoRoot = FindRepoRoot();
        var scriptPath = Path.Combine(repoRoot, "gravops-desktop-shell", "Scripts", "jd-webview-reader.js");
        if (!File.Exists(scriptPath))
        {
            throw new FileNotFoundException("JD WebView reader script not found", scriptPath);
        }

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
        var attributeCount = product.TryGetProperty("attributes", out var attributesProp) && attributesProp.ValueKind == JsonValueKind.Object
            ? attributesProp.EnumerateObject().Count()
            : 0;
        if (string.IsNullOrWhiteSpace(title) || (imageCount == 0 && detailCount == 0))
        {
            throw new InvalidOperationException($"当前页没有读到完整商品信息：title={(!string.IsNullOrWhiteSpace(title))}, mainImages={imageCount}, detailImages={detailCount}, attributes={attributeCount}");
        }
        return product;
    }

    private async Task<string> GetAppTokenAsync()
    {
        var json = await appView.CoreWebView2.ExecuteScriptAsync("localStorage.getItem('token') || ''");
        return JsonSerializer.Deserialize<string>(json) ?? "";
    }

    private async Task OpenTaskCenterAsync()
    {
        appView.CoreWebView2.Navigate($"{BackendUrl}/dashboard/tasks");
        await Task.CompletedTask;
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
