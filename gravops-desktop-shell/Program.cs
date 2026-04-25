using System;
using System.Windows.Forms;

namespace Gravops.Desktop;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        try
        {
            ApplicationConfiguration.Initialize();
            Application.Run(new MainForm());
        }
        catch (Exception ex)
        {
            var logPath = Path.Combine(AppContext.BaseDirectory, "startup-error.log");
            File.WriteAllText(logPath, ex.ToString());
            MessageBox.Show(ex.ToString(), "Gravops 启动失败", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
}
