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
    private readonly WebView2 appView = new();
    private readonly WebView2 browserView = new();
    private readonly WebView2 zcyView = new();
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

        browserView.CoreWebView2.WebResourceResponseReceived += (_, e) => _ = CaptureJdNetworkResponseAsync(e);

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
        appView.CoreWebView2.Navigate($"{BackendUrl}/dashboard/tasks");
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
