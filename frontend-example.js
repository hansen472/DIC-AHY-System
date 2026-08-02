/**
 * 前端调用示例：把 jilu04.html 中的 doPrint 改造成向后端请求 PDF
 *
 * 假设后端跑在 http://localhost:3456
 * 只需把原来的 window.print() 流程替换为下面这段即可。
 */

const PDF_API_URL = 'http://localhost:3456/api/print';

async function doPrint() {
  // 1. 收集勾选的数据行
  const checkedBoxes = document.querySelectorAll('.row-check:checked');
  const selectedRows = Array.from(checkedBoxes).map(cb => sourceData[cb.dataset.index]).slice(0, 10);

  if (selectedRows.length === 0) {
    alert('没有数据，请先查询并勾选数据');
    return;
  }

  // 2. 收集模板任务（支持多模板、各打各的份数）
  const checkedTpls = Array.from(document.querySelectorAll('.tpl-check:checked')).map(cb => cb.dataset.tpl);
  const copiesMap = {};
  document.querySelectorAll('.tpl-copies').forEach(inp => {
    copiesMap[inp.dataset.tpl] = parseInt(inp.value) || 0;
  });

  if (checkedTpls.length === 0) {
    alert('请至少勾选一种模板');
    return;
  }

  const tasks = checkedTpls.map(tpl => ({
    template: tpl,
    copies: copiesMap[tpl] || 1
  }));

  // 3. 显示加载状态
  const btn = document.querySelector('.btn-success[onclick="doPrint()"]');
  const originalText = btn ? btn.textContent : '打印 / 导出 PDF';
  if (btn) { btn.disabled = true; btn.textContent = '正在生成 PDF...'; }

  try {
    const response = await fetch(PDF_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        records: selectedRows,
        tasks: tasks
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'PDF 生成失败');
    }

    // 4. 拿到 PDF Blob，在新标签页打开（浏览器会显示 PDF 预览，用户可直接打印或下载）
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    // 方式 A：新标签页打开，用户用浏览器 PDF 阅读器打印
    window.open(url, '_blank');

    // 方式 B：直接触发下载（取消上面那行注释下面这行）
    // const a = document.createElement('a');
    // a.href = url;
    // a.download = `打印_${new Date().toISOString().slice(0,10)}.pdf`;
    // a.click();

    // 5. 几秒后释放 blob URL
    setTimeout(() => URL.revokeObjectURL(url), 30000);

  } catch (err) {
    console.error(err);
    alert('打印失败：' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = originalText; }
  }
}
