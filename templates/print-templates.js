/**
 * 打印模板渲染函数库
 * 部署说明：将此文件部署到服务器的静态资源目录下，
 * 通过 HTTP 远程加载，确保前端 HTML 无法直接修改模板内容。
 */

/* ========== SOR-SC-003 模板 B：配料工序生产记录 ========== */
function renderBatchRecord(row, idx) {
  // 生成24条空行（加上第一条共25行，匹配 rowspan=25）
  let emptyRows = '';
  for (let i = 0; i < 24; i++) {
    emptyRows += '<tr class="print-row-h"><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>';
  }

  return `
    <div class="page-sheet" data-tpl="batchrecord">
      <table class="print-meta-table">
        <tr>
          <td style="width:16%; height: 45px; vertical-align: middle;" class="logo-cell" padding: 4px><img src="images/logo.png" alt="Aptar Pharma Logo" style="width:88%"></td>
          <td style="width:13%;">记录编号</td>
          <td class="arial-val" style="width:14%;">SOR-SC-003</td>
          <td style="width:7%;">版号</td>
          <td class="arial-val" style="width:8%;">04</td>
          <td style="width:12%;">生效日期</td>
          <td class="arial-val" style="width:14%;">2026.06.01</td>
          <td style="width:8%;">页码</td>
          <td class="arial-val" style="width:10%;">1/1</td>
        </tr>
      </table>

      <div class="print-page-title">
        <h1>配料工序生产记录</h1>
      </div>

      <table class="print-table">
        <tr>
          <td style="width:10%;">产品名称</td>
          <td colspan="2" style="width:60%;">${row.mingcheng || ''}</td>
          <td style="width:10%;">生产批号</td>
          <td style="width:20%;" colspan="2">${row.pici || ''}</td>
        </tr>
        <tr>
          <td style="width:10%;">型&nbsp;&nbsp;号</td>
          <td style="width:18%;">${row.xinghao || ''}</td>
          <td style="width:12%;">规&nbsp;&nbsp;格</td>
          <td style="width:12%;">${row.guige || ''}</td>
          <td style="letter-spacing:7px;">配方号</td>
          <td>${row.peifang || ''}</td>
        </tr>
        <tr>
          <td>生产日期</td>
          <td colspan="3" class="left">
            <span class="print-letter-6">&nbsp;&nbsp;年 月 日 时 分</span>
            <span style="padding:0 10px; font-weight:bold;">～</span>
            <span class="print-letter-6">年 月 日 时 分</span>
          </td>
          <td style="letter-spacing:10px;">班次</td>
          <td></td>
        </tr>
        <tr>
          <td colspan="6" class="no-pad no-border">
            <table class="print-subtable">
              <tr>
                <td colspan="9" class="section-header">生产过程操作</td>
              </tr>
               
             <tr>
                <td colspan="2" style="width:16%;">物料序号</td>
                <td style="width:12%;">1</td>
                <td style="width:12%;">2</td>
                <td style="width:12%;">3</td>
                <td style="width:12%;">4</td>
                <td style="width:12%;">5</td>
                <td style="width:12%;">6</td>
                <td style="width:12%;">7</td>
              </tr>
              
              <tr>
                <td colspan="2" >电子称编号</td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
              <tr>
                <td colspan="2">物料代码</td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
              <tr>
                <td colspan="2">原料批号</td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
              <tr>
                <td colspan="2">配方表重量<br>(kg)</td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
              <tr class="print-row-h">
                <td rowspan="25">每车称量重量<br>(kg)，按照电子称的实际显示位数填写</td>
                <td style="width:4%;"></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
              ${emptyRows}
              <tr>
                <td colspan="2">操作人</td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
              <tr>
                <td colspan="2">复核人</td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
           
              <tr >
                <td colspan="9" style="padding-left:25px; text-align: left;">&nbsp;备&nbsp;注</td>
              </tr>
           
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

/* ========== SOR-SC-001模板 A：封皮 ========== */
function renderCover(row, idx) {
  return `
    <div class="page-sheet" data-tpl="cover" style="padding:15mm 20mm;">
      <div class="print-cover-header">
        <table class="print-meta-table">
          <tr>
            <td style="width:15%; padding:8px;">
              <img src="images/logo.png" alt="Aptar Pharma Logo" style="max-width:100%; height:auto; max-height:45px; display:block; margin:0 auto;">
            </td>
            <td style="width:15%; padding:8px 4px;">记录编号</td>
            <td class="arial-val"  style="width:15%; padding:8px 4px;">SOR-SC-001</td>
            <td style="width:6%; padding:8px 4px;">版号</td>
            <td class="arial-val"  style="width:8%; padding:8px 4px;">03</td>
            <td style="width:12%; padding:8px 4px;">生效日期</td>
            <td class="arial-val" style="width:14%; padding:8px 4px;">2026.06.22</td>
            <td style="width:8%; padding:8px 4px;">页码</td>
            <td class="arial-val"  style="width:7%; padding:8px 4px;">1/1</td>
          </tr>
        </table>
      </div>
      <div class="print-cover-title-box">
        <h1>批生产记录</h1>
      </div>
      <div class="print-cover-info">
        <div class="info-line">
          <span class="info-label">产 品 名 称：</span>
          <span class="info-value">${row.mingcheng || ''}</span>
        </div>
        <div class="info-line">
          <span class="info-label">生 产 批 号：</span>
          <span class="info-value">${row.pici || ''}</span>
        </div>
        <div class="info-line">
          <span class="info-label">型　　号：</span>
          <span class="info-value">${row.xinghao || ''}</span>
        </div>
        <div class="info-line">
          <span class="info-label">规　　格：</span>
          <span class="info-value">${row.guige || ''}</span>
        </div>
        <div class="info-line">
          <span class="info-label">生 产 批 量：</span>
          <span class="info-value" style="padding-bottom:35px;"></span>
        </div>
        <div class="info-line">
          <span class="info-label">生产开始日期：</span>
          <span class="date-box" style="width:85px;"></span> 年
          <span class="date-box" style="width:85px; margin-left:8px;"></span> 月
          <span class="date-box" style="width:85px; margin-left:8px;"></span> 日
        </div>
        <div class="info-line">
          <span class="info-label">生产结束日期：</span>
          <span class="date-box" style="width:85px;"></span> 年
          <span class="date-box" style="width:85px; margin-left:8px;"></span> 月
          <span class="date-box" style="width:85px; margin-left:8px;"></span> 日
        </div>
      </div>
    </div>
  `;
}

/* ========== SOR-SC-004模板 C：密炼工序生产记录（横向） ========== */
function renderMixingRecord(row, idx) {


  return `
    <div class="page-sheet-landscape" data-tpl="mixingrecord">
      <table class="print-meta-table">
        <tr>
          <td class="logo-cell" style="width:11%;"><img src="images/logo.png" alt="Aptar Pharma Logo" style="width:80%"></td>
          <td style="width:11%;">记录编号</td>
          <td class="arial-val" style="width:14%;">SOR-SC-004</td>
          <td style="width:8%;">版号</td>
          <td class="arial-val" style="width:8%;">06</td>
          <td style="width:12%;">生效日期</td>
          <td class="arial-val" style="width:14%;">2026.06.15</td>
          <td style="width:8%;">页码</td>
          <td class="arial-val" style="width:7%;">1/1</td>
        </tr>
      </table>

      <div class="print-page-title">
        <h1>密炼工序生产记录</h1>
      </div>

      <table class="print-table">
        <tr>
          <td style="width:8%;">产品名称</td>
          <td  colspan="5">${row.mingcheng || ''}</td>
          <td style="width:10%;">生产批号</td>
          <td style="width:15%;">${row.pici || ''}</td>
          <td style="width:8%;">型&nbsp;&nbsp;号</td>
          <td colspan="2" style="width:15%;">${row.xinghao || ''}</td>
        </tr>
        <tr>
          <td>规&nbsp;&nbsp;格</td>
          <td style="width:10%;">${row.guige || ''}</td>
          <td style="width:10%;">配 方 号</td>
          <td style="width:10%;">${row.peifang || ''}</td>
          <td style="width:11%;">生产日期</td>
          <td  class="right" colspan="4">
            <span class="print-letter-6">年 月 日 时 分</span>
            <span style="padding:0 8px; font-weight:bold;">～</span>
            <span class="print-letter-6">年 月 日 时 分</span>
          </td>
          <td style="width:8%;">班&nbsp;&nbsp;次</td>
          <td style="width:8%;"></td>
          
        </tr>
    
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td colspan="8" class="section-header-top">生产过程操作</td>
        </tr>
        <tr>
          <td  style="width:12%;">密炼机编号</td>
          <td  class="arial-val" style="width:10%;">XS-MLJ-01</td>
          <td  style="width:15%;">压缩空气压力(kg/cm<sup>2</sup>)</td>
          <td  style="width:8%;"></td>
          <td  style="width:12%;">循环水压(Mpa)</td>
          <td  style="width:12%;"></td>
          <td  style="width:12%;">冷却水温(℃)</td>
          <td  style="width:12%;"></td>
        </tr>
        
      </table>
      
      <table class="print-subtable" style="margin-top:-1px;">
      
      
                  <!-- 步骤行 -->
         <tr >
           <td rowspan="2"  style="height: 80px;">步骤</td>
           <td rowspan="2" colspan="4" >物料代码</td>

           <td >时间</td>
           <td >温度</td>
           <td >转速</td>
           <td >加压压力</td>
           <td colspan="23">车数及操作步骤确认</td>
         </tr>
          <tr>                     
            <td>(s)</td>
            <td>(℃)</td>
            <td>(RPM)</td>
            <td>(kg/cm²)</th>
            <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>                      
          </tr>

      
          
              
                 <!-- 第1段 -->
         <tr>
           <td rowspan="2"   style="height: 80px;" >第1段</td>
           <td></td> <td></td> <td></td> <td></td>
           <td rowspan="2" ></td>
           <td rowspan="2" >/</td>
           <td rowspan="2" ></td>
           <td rowspan="2" ></td>
           <td rowspan="2" ><td rowspan="2" ><td rowspan="2" ><td rowspan="2" ><td rowspan="2" ><td rowspan="2" ><td rowspan="2" ><td rowspan="2" ><td rowspan="2" ><td rowspan="2" ><td rowspan="2" ><td rowspan="2" ><td rowspan="2" ><td rowspan="2" ><td rowspan="2" ><td rowspan="2" ><td rowspan="2" ><td rowspan="2" ><td rowspan="2" ><td rowspan="2" ><td rowspan="2" ><td rowspan="2" ><td rowspan="2" >  
         </tr> 
         <tr>   
           <td></td> <td></td> <td></td> <td></td>
                    
         </tr>
                  
                <!-- 第2段 -->
         <tr>
           <td style="height: 40px;" >第2段</td>
           <td></td> <td></td> <td></td> <td></td>
           <td></td>
           <td>/</td>
           <td></td>
           <td></td>
           <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>   
         </tr> 
         
                <!-- 第3段 -->
         <tr>
           <td style="height: 40px;" >第3段</td>
           <td colspan="4"></td> 
           <td></td>
           <td>/</td>
           <td></td>
           <td></td>
           <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>   
         </tr> 
         
               <!-- 第4段 -->
         <tr>
           <td style="height: 40px;" >第4段</td>
           <td colspan="4"></td> 
           <td>/</td>
           <td></td>
           <td></td>
           <td></td>
           <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>   
         </tr> 
                        <!-- 第5段 -->
         <tr>
           <td style="height: 40px;" >第5段</td>
           <td colspan="4">/</td> 
           <td>/</td>
           <td></td>
           <td></td>
           <td></td>
           <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>   
         </tr> 
         
                                 <!-- 操作人：          复核人： -->
<tr>
    <td style="height: 40px; text-align: left; padding-left: 20px;" colspan="32">
        操作人：<span style="margin-left: 600px;">复核人：</span>
    </td>
</tr>
         
        
      </table>
        

      <table class="print-table" style="margin-top:8px;">
        <tr>
          <td class="left" style="font-size:14px;">注：完成相应的操作步骤后在车数对应的空格打“√”</td>
        </tr>
        <tr class="print-row-h-lg">
          <td class="left" style="font-size:14px;">&nbsp;&nbsp;备&nbsp;注：</td>
        </tr>
      </table>
    </div>
  `;
}

/* ========== SOR-SC-006 模板 E：硫化工序生产记录 ========== */
function renderVulcanizingRecord(row, idx) {
  // 灯检记录空行（6条）
  let inspectionRows = '';
  for (let i = 0; i < 6; i++) {
    inspectionRows += `
      <tr>       
        <td colspan="3" style="height: 22px; padding: 2px 4px;"> <span class="print-letter-6">年 月 日 时 分 ～ 时 分</span></td>
        <td style="height: 22px; padding: 2px 4px;"></td>
        <td style="height: 22px; padding: 2px 4px;"></td>
        <td style="height: 22px; padding: 2px 4px;"></td>
        <td style="height: 22px; padding: 2px 4px;"></td>
        <td colspan="2" style="height: 22px; padding: 2px 4px;"></td>
      </tr>
    `;
  }

  return `
    <div class="page-sheet" data-tpl="vulcanizingrecord" >
      <table class="print-meta-table">
        <tr>
          <td class="logo-cell" style="width:11%;"><img src="images/logo.png" alt="Aptar Pharma Logo" style="width:80%"></td>
          <td style="width:11%;">记录编号</td>
          <td class="arial-val" style="width:14%;">SOR-SC-006</td>
          <td style="width:8%;">版号</td>
          <td class="arial-val" style="width:8%;">09</td>
          <td style="width:12%;">生效日期</td>
          <td class="arial-val" style="width:14%;">2026.06.15</td>
          <td style="width:8%;">页码</td>
          <td class="arial-val" style="width:7%;">1/1</td>
        </tr>
      </table>

      <div class="print-page-title" style="margin-bottom:8px;">
         <h1 style="margin: 0; line-height: 1; ">硫化工序生产记录</h1>
      </div>
      <table class="print-table">
        <tr>
          <td style="width:10%;">产品名称</td>
          <td colspan="3">${row.mingcheng || ''}</td>
          <td style="width:12%;">生产批号</td>
          <td colspan="3">${row.pici || ''}</td>
        </tr>
        <tr>
          <td>型&nbsp;&nbsp;号</td>
          <td style="width:25%;">${row.xinghao || ''}</td>
          <td style="width:8%;">规&nbsp;&nbsp;格</td>
          <td style="width:12%;">${row.guige || ''}</td>
          <td style="width:10%;">配 方 号</td>
          <td style="width:13%;">${row.peifang || ''}</td>
          <td style="width:12%;">硫化序号</td>
          <td style="width:12%;"></td>
        </tr>
        <tr>
          <td>生产日期</td>
          <td colspan="4" class="left">
            <span class="print-letter-6">年 月 日 时 分</span>
            <span style="padding:0 8px; font-weight:bold;">～</span>
            <span class="print-letter-6">年 月 日 时 分</span>
          </td>
          <td>班&nbsp;&nbsp;次</td>
          <td colspan="2"></td>
        </tr>
        <tr>
          <td>设备编号</td>
          <td colspan="3"></td>
          <td>机&nbsp;&nbsp;台</td>
          <td colspan="3"></td>
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td colspan="5" style="height: 22px; padding: 2px 4px;font-weight: bold;">生产参数确认</td>
        </tr>
        <tr>
          <td style="width:12%;">参数</td>
          <td style="width:22%;">加硫/排气压力(kg/cm²)</td>
          <td style="width:22%;">硫化上模温度(℃)</td>
          <td style="width:22%;">硫化下模温度(℃)</td>
          <td style="width:22%;">硫化总时间(s)</td>        </tr>
        <tr>
          <td style="height: 22px; padding: 2px 4px;">工艺值</td>
          <td style="height: 22px; padding: 2px 4px;"></td>
          <td style="height: 22px; padding: 2px 4px;"></td>
          <td style="height: 22px; padding: 2px 4px;"></td>
          <td style="height: 22px; padding: 2px 4px;"></td>
        </tr>
        <tr>
          <td style="height: 22px; padding: 2px 4px;">实际值</td>
          <td style="height: 22px; padding: 2px 4px;"></td>
          <td style="height: 22px; padding: 2px 4px;"></td>
          <td style="height: 22px; padding: 2px 4px;"></td>
          <td style="height: 22px; padding: 2px 4px;"></td>
        </tr>
        <tr>
          <td rowspan="2" style="width:12%;">用胶量</td>
          <td style="height: 22px; padding: 2px 4px;">电子秤编号</td>
          <td colspan="2" style="height: 22px; padding: 2px 4px;"></td>
          <td style="height: 22px; padding: 2px 4px;">操作人</td>
        </tr>
        <tr>
          <td style="height: 22px; padding: 2px 4px;">重&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;量</td>
          <td colspan="2" style="height: 22px; padding: 2px 4px;">（_____±_____g）*_____片</td>
          <td style="height: 22px; padding: 2px 4px;">复核人</td>
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td colspan="8" style="height: 22px; padding: 2px 4px;font-weight: bold;">首件检验</td>
          
          
          
        </tr>
        <tr>
          <td colspan="2" rowspan="2" style="width:24%;" >检验项目</td>
          <td rowspan="2" style="width:12%;">判定标准</td>
          <td rowspan="2" style="width:12%;">检验数量</td>
          <td colspan="4"  style="width:52%; height: 22px; padding: 2px 4px;width:14%;">检验时间</td>
        </tr>
        <tr>
          <td style="width:13%; height: 20px; padding: 2px 4px;"></td>
          <td style="width:13%; height: 20px; padding: 2px 4px;"></td>
          <td style="width:13%; height: 20px; padding: 2px 4px;"></td>
          <td style="width:13%; height: 20px; padding: 2px 4px;"></td>
        </tr>
        <tr>
          <td colspan="2" style="height: 20px; padding: 2px 4px;">产品混淆</td>
          <td style="height: 20px; padding: 2px 4px;">不允许</td>
          <td rowspan="4" style="width:12%;">正常生产的第一模产品</td>
          <td style="height: 20px; padding: 2px 4px;"></td>
          <td style="height: 20px; padding: 2px 4px;"></td>
          <td style="height: 20px; padding: 2px 4px;"></td>
          <td style="height: 20px; padding: 2px 4px;"></td>
        </tr>
        <tr>
          <td colspan="2" style="height: 20px; padding: 2px 4px;">生物污染 (毛发、血液、皮肤、昆虫等)</td>
          <td style="height: 20px; padding: 2px 4px;">不允许</td>
          <td style="height: 20px; padding: 2px 4px;"></td>
          <td style="height: 20px; padding: 2px 4px;"></td>
          <td style="height: 20px; padding: 2px 4px;"></td>
          <td style="height: 20px; padding: 2px 4px;"></td>
        </tr>
        <tr>
          <td colspan="2" style="font-size: 11px; line-height: 1.3; text-align: left; padding: 4px 6px;">
            外观缺陷：<br>
            1. 标识与模具编号不完整<br>
            2. 防粘连点不完整<br>
            3. 橡胶件不完全成型、撕裂、缺口、海绵状构造，影响密封和/或功能。<br>
            4. 多个＞0.2 mm²的包含物/污渍，或1个＞1 mm²的包含物/污渍（药物接触区域）<br>
            5. 嵌入式颗粒或斑点 ≥1mm²
          </td>
          <td style="font-size: 11px; line-height: 1.3; padding: 4px 6px;">剔除不合格品后，合格率≥95%</td>
          <td style="height: 20px; padding: 2px 4px;"></td>
          <td style="height: 20px; padding: 2px 4px;"></td>
          <td style="height: 20px; padding: 2px 4px;"></td>
          <td style="height: 20px; padding: 2px 4px;"></td>
        </tr>
        <tr>
          <td colspan="2" style="height: 20px; padding: 2px 4px;">肉眼可见的金属颗粒</td>
          <td style="height: 20px; padding: 2px 4px;">不允许</td>
          <td style="height: 20px; padding: 2px 4px;"></td>
          <td style="height: 20px; padding: 2px 4px;"></td>
          <td style="height: 20px; padding: 2px 4px;"></td>
          <td style="height: 20px; padding: 2px 4px;"></td>
        </tr>
        <tr>
          <td colspan="8" class="left" style="height: 20px; padding: 2px 6px; font-size: 12px;">
            注：在更换产品、更换批号、停机再开机后需进行首件检验。根据检查结果，在对应"□"内合格打"√"，不合格打"×"。
          </td>
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td colspan="9" style="height: 22px; padding: 2px 4px;font-weight: bold;font-size: 14px;">生产结束后统计（重量保留2位小数）</td>
        </tr>
        <tr>
          <td colspan="2" style="width:18%; height: 22px; padding: 2px 4px;">电子秤编号</td>
          <td colspan="7" style="height: 22px; padding: 2px 4px;"></td>
        </tr>
        <tr>
          <td style="width:10%; height: 22px; padding: 2px 4px;width:14%;">硫化总模数</td>
          <td style="width:10%; height: 22px; padding: 2px 4px;"></td>
          <td style="width:10%; height: 22px; padding: 2px 4px;">合格模数</td>
          <td style="width:10%; height: 22px; padding: 2px 4px;"></td>
          <td style="width:10%; height: 22px; padding: 2px 4px;">取样模数</td>
          <td style="width:10%; height: 22px; padding: 2px 4px;"></td>
          <td style="width:10%; height: 22px; padding: 2px 4px;">不合格模数</td>
          <td colspan="2" style="height: 22px; padding: 2px 4px;"></td>
        </tr>
        <tr>
          <td style="height: 22px; padding: 2px 4px;">废边量(kg)</td>
          <td style="height: 22px; padding: 2px 4px;"></td>
          <td colspan="1" style="height: 22px; padding: 2px 4px; width:22%;">未灯检的合格品重量(kg)</td>
          <td style="height: 22px; padding: 2px 4px;"></td>
          <td style="height: 22px; padding: 2px 4px;">取样(kg)</td>
          <td style="height: 22px; padding: 2px 4px;"></td>
          <td style="height: 22px; padding: 2px 4px;width:14%;">不合格品(kg)</td>
          <td style="height: 22px; padding: 2px 4px;"></td>
        </tr>
        <tr>
          <td colspan="4" style="height: 22px; padding: 2px 4px;">批硫化结束后剩余未硫化胶片的重量(kg)</td>
          <td colspan="5" style="height: 22px; padding: 2px 4px;"></td>
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td colspan="3" style="width:40%; height: 22px; padding: 2px 4px;" >灯检日期</td>
          <td style="width:10%; height: 22px; padding: 2px 4px;">灯检班次</td>
          <td style="width:12%; height: 22px; padding: 2px 4px;">合格品(kg)</td>
          <td style="width:18%; height: 22px; padding: 2px 4px;">不合格品(kg)</td>
          <td style="width:10%; height: 22px; padding: 2px 4px;">模数</td>
          <td colspan="2" style="width:10%; height: 22px; padding: 2px 4px;">操作人</td>
        </tr>
        ${inspectionRows}
        <tr>
          <td colspan="3" style="height: 22px; padding: 2px 4px;">合计</td>
          <td colspan="5" style="height: 22px; padding: 2px 4px;"></td>
          <td style="height: 22px; padding: 2px 4px;">/</td>
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td colspan="9"  style="height: 22px; padding: 2px 6px; text-align: left;">
            不合格品进行集中废弃处理：□是&nbsp;&nbsp;□否&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;复核人：
          </td>
        </tr>
        <tr>
          <td colspan="9"  style="height: 22px; padding: 2px 6px; text-align: left; ">
            注：硫化序号为窗口号加班次顺序号，如1A1,1A2,1A3…
          </td>
        </tr>
        <tr>
          <td style="width:12%; height: 24px; text-align: left;">备注</td>
          <td colspan="8" style="height: 24px;"></td>
        </tr>
      </table>
    </div>
  `;
}

/* ========== SOR-SC-005 模板 D：压延工序生产记录 ========== */
function renderCalenderingRecord(row, idx) {
  return `
    <div class="page-sheet" data-tpl="calenderingrecord" style="margin-bottom:1px;">
      <table class="print-meta-table">
        <tr>
          <td class="logo-cell" style="width:11%;"><img src="images/logo.png" alt="Aptar Pharma Logo" style="width:80%"></td>
          <td style="width:11%;">记录编号</td>
          <td class="arial-val" style="width:14%;">SOR-SC-005</td>
          <td style="width:8%;">版号</td>
          <td class="arial-val" style="width:8%;">06</td>
          <td style="width:12%;">生效日期</td>
          <td class="arial-val" style="width:14%;">2026.06.15</td>
          <td style="width:8%;">页码</td>
          <td class="arial-val" style="width:7%;">1/1</td>
        </tr>
      </table>

      <div class="print-page-title" style="margin-bottom:8px;">
         <h1 style="margin: 0; line-height: 1; ">压延工序生产记录</h1>
      </div>

      <table class="print-table">
        <tr>
          <td style="width:10%;">产品名称</td>
          <td colspan="2">${row.mingcheng || ''}</td>
          <td style="width:12%;">生产批号</td>
          <td colspan="2">${row.pici || ''}</td>
         
        </tr>
        <tr>
         <td style="width:10%;">型&nbsp;&nbsp;号</td>
          <td style="width:25%;">${row.xinghao || ''}</td>
          <td style="width:10%;">规&nbsp;&nbsp;格</td>
          <td style="width:15%;">${row.guige || ''}</td>
          <td style="width:10%;">配方号</td>
          <td style="width:15%;">${row.peifang || ''}</td>
      
        </tr>
        
        <tr>
            <td style="width:10%;">生产日期</td>
            <td colspan="3" class="left">
            <span class="print-letter-6" style="text-align: left; padding-left: 20px;" >年 月 日 时 分</span>
            <span style="padding:0 8px; font-weight:bold;">～</span>
            <span class="print-letter-6">年 月 日 时 分</span>
            <td style="width:10%;">班次</td>
            <td></td>
          </td>
             
        </tr>
        
        <tr>
          <td style="width:10%;">设备名称</td>
          <td colspan="7" class="left">压延机：XS-JPYYJ-01；冷却机：XS-BGLQJ-01</td>
        </tr>
        <tr>
          <td colspan="8" class="left" style="height:28px; padding:6px 8px; font-size:14px;">
            生产前用检针检测金检机是否正常工作：铁□&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;非铁□&nbsp;&nbsp;&nbsp;不锈钢□ （正常打“√”，异常打“×”）
          </td>
        </tr>
      </table>
      


     
      <table  class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td colspan="27" class="section-header-top"  style="height: 18px;">生产结束后统计（重量保留2位小数）</td>
        </tr>
        <tr>
          <td colspan="4" style="width:15%;">电子秤编号</td>
          <td colspan="23"></td>
        </tr>
        <tr>
          <td colspan="27" class="section-header-top">出片重量（kg）</td>
        </tr>
        <tr>
          <td colspan="4">托盘1</td>
          <td colspan="4">托盘2</td>
          <td colspan="4">托盘3</td>
          <td colspan="4">托盘4</td>
          <td colspan="4">托盘5</td>
          <td colspan="4">托盘6</td>
          <td colspan="3">合计</td>
        </tr>
        <tr>
        <td colspan="4" style="height: 24px; box-sizing: border-box;"></td>
        <td colspan="4" style="height: 24px; box-sizing: border-box;"></td>
        <td colspan="4" style="height: 24px; box-sizing: border-box;"></td>
        <td colspan="4" style="height: 24px; box-sizing: border-box;"></td>
        <td colspan="4" style="height: 24px; box-sizing: border-box;"></td>
        <td colspan="4" style="height: 24px; box-sizing: border-box;"></td>
        <td colspan="4" style="height: 24px; box-sizing: border-box;"></td>
        </tr>
        <tr>
          <td colspan="5" style="width:8%;">IPQC取样(kg)</td>
          <td colspan="5" style="width:22%;">硫化试验取样量(kg)</td>
          <td colspan="6" style="width:22%;">废胶量(含机头胶)(kg)</td>
          <td colspan="5" style="width:18%;">不合格重量(kg)</td>
          <td colspan="6" rowspan="2"  style="padding-left: 0; padding-right: 0;width:30%;">
            不合格品集中废弃处理：<br/>
            □是&nbsp;&nbsp; □否
          </td>
        </tr>
        <tr>
          <td colspan="5" style="height: 24px; box-sizing: border-box;"></td>
          <td colspan="5" style="height: 24px; box-sizing: border-box;"></td>
          <td colspan="6" style="height: 24px; box-sizing: border-box;"></td>
          <td colspan="5" style="height: 24px; box-sizing: border-box;"></td>
          
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td style="padding-left:10px; height:14px;text-align: left;">
            操作人：<span style="margin-left: 200px;">复核人：</span>
          </td>
        </tr>
        
         <tr >
          <td style=" font-size:14px; text-align: left;">备&nbsp;注：</td>
        </tr>
      </table>

    </div>
  `;
}

/* ========== 模板 F：除边工序生产记录 ========== */
function renderTrimmingRecord(row, idx) {
  let dataRows = '';
  for (let i = 0; i < 6; i++) {
    dataRows += `
      <tr>
        <td colspan="5" style="height: 32px; padding: 2px 4px;"></td>
        <td colspan="4" style="height: 32px; padding: 2px 4px;"></td>
        <td colspan="5" style="height: 32px; padding: 2px 4px;"></td>
        <td colspan="5" style="height: 32px; padding: 2px 4px;"></td>
        <td colspan="6" style="height: 32px; padding: 2px 4px;"></td>
      </tr>
    `;
  }

  return `
    <div class="page-sheet" data-tpl="trimmingrecord">
      <table class="print-meta-table">
        <tr>
          <td class="logo-cell" style="width:11%;"><img src="images/logo.png" alt="Aptar Pharma Logo" style="width:80%"></td>
          <td style="width:11%;">记录编号</td>
          <td class="arial-val" style="width:14%;">SOR-SC-007</td>
          <td style="width:8%;">版号</td>
          <td class="arial-val" style="width:8%;">04</td>
          <td style="width:12%;">生效日期</td>
          <td class="arial-val" style="width:14%;">2026.06.18</td>
          <td style="width:8%;">页码</td>
          <td class="arial-val" style="width:7%;">1/1</td>
        </tr>
      </table>

      <div class="print-page-title">
        <h1>除边工序生产记录</h1>
      </div>

      <table class="print-table">
        <tr>
          <td style="width:10%;">产品名称</td>
          <td colspan="2">${row.mingcheng || ''}</td>
          <td style="width:12%;">生产批号</td>
          <td colspan="2">${row.pici || ''}</td>
        </tr>
        <tr>
          <td>型&nbsp;&nbsp;号</td>
          <td style="width:25%;">${row.xinghao || ''}</td>
          <td style="width:10%;">规&nbsp;&nbsp;格</td>
          <td style="width:15%;">${row.guige || ''}</td>
          <td style="width:10%;">配方号</td>
          <td style="width:15%;">${row.peifang || ''}</td>
        </tr>
        <tr>
          <td>生产日期</td>
          <td colspan="3" class="left" style="text-align: center;">
            <span class="print-letter-6">年 月 日 时 分</span>
            <span style="padding:0 8px; font-weight:bold;">～</span>
            <span class="print-letter-6">&nbsp;年 月 日 时 分</span>
          </td>
          <td>班&nbsp;&nbsp;次</td>
          <td></td>
        </tr>
        <tr>
          <td>设备编号</td>
          <td colspan="2"></td>
          <td>机&nbsp;&nbsp;台</td>
          <td colspan="2"></td>
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td colspan="25" class="section-header-top">首件检验</td>
        </tr>
        <tr>
          <td colspan="5" rowspan="2" style="width:20%;">自检项目</td>
          <td colspan="2" rowspan="2" style="width:10%;">判定标准</td>
          <td colspan="18">检验时间</td>
        </tr>
        <tr>
          <td colspan="3" style="height: 30px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 30px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 30px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 30px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 30px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 30px; padding: 2px 4px;"></td>
        </tr>
        <tr>
          <td colspan="5"  style="font-size:12px; line-height:1.4; text-align:left; padding:4px 6px;">
            除边错误，影响密封性和/或功能；
          </td>
          <td colspan="2" rowspan="2" style="font-size:12px; line-height:1.4; padding:4px 6px;">抽检200个，不合格品≤2个</td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
        </tr>
        <tr>
            <td colspan="5"  style="font-size:12px; line-height:1.4; text-align:left; padding:4px 6px;">
             橡胶颗粒≥1mm&sup2;，或除边胶屑&gt;2mm；
          </td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
        </tr>
        <tr>
          <td colspan="5" style="font-size:12px; line-height:1.4; text-align:left; padding:4px 6px;">肉眼可见的金属颗粒。</td>
          <td colspan="2" style="font-size:12px; padding:4px 6px;">不允许</td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
        </tr>
        <tr>
          <td colspan="25" class="left" style="font-size:12px; padding:6px 8px; line-height:1.4;">
            注：在更换批号、停机再开机后需进行首件检验，首件检验为正常冲切的第一模产品。根据检查结果，在对应"□"内合格打"√"，不合格打"×"。
          </td>
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td colspan="25" class="section-header-top">生产结束后统计（重量保留2位小数）</td>
        </tr>
        <tr>
          <td colspan="5">电子秤编号</td>
          <td colspan="4"></td>
          <td colspan="10">隔离液配置日期(有效期3天)</td>
          <td colspan="6"></td>
        </tr>
        <tr>
          <td colspan="5" style="font-size:12px; line-height:1.4;">硫化序号<br/>（按先进先出领取）</td>
          <td colspan="4">除边序号</td>
          <td colspan="5">合格品（kg）</td>
          <td colspan="5">网边重量（kg）</td>
          <td colspan="6">不合格品重量（kg）</td>
        </tr>
        ${dataRows}
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td colspan="25" class="left" style="font-size:14px; padding:6px 8px;">
            不合格品进行集中废弃处理：□是&nbsp;&nbsp;□否
          </td>
        </tr>
        <tr>
          <td colspan="25" style="padding-left:10px; height:14px;text-align: left;">
            操作人：<span style="margin-left: 300px;">生产复核人：</span>
          </td>
        </tr>
        <tr>
          <td colspan="25" style="padding-left:10px; height:14px;text-align: left;">备注：</td>
        </tr>
        <tr>
          <td colspan="25" style="padding-left:10px; height:14px;text-align: left;">
            注：除边序号，以机台号和顺序号表示，如1#1、1#2、1#3......，表示1号机台+顺序号；同一个硫化序号不同的除边人，应分别编号。
          </td>
        </tr>
      </table>
    </div>
  `;
}

/* ========== 模板 G：清洗工序生产记录 ========== */
function renderCleaningRecord(row, idx) {
  let trimmingRows = '';
  for (let r = 0; r < 3; r++) {
    trimmingRows += '<tr>';
    for (let c = 0; c < 12; c++) {
      trimmingRows += '<td colspan="2" style="height: 36px; padding: 2px 4px;"></td>';
    }
    trimmingRows += '</tr>';
  }

  return `
    <div class="page-sheet" data-tpl="cleaningrecord">
      <table class="print-meta-table">
        <tr>
          <td class="logo-cell" style="width:11%;"><img src="images/logo.png" alt="Aptar Pharma Logo" style="width:80%"></td>
          <td style="width:11%;">记录编号</td>
          <td class="arial-val" style="width:14%;">SOR-SC-008</td>
          <td style="width:8%;">版号</td>
          <td class="arial-val" style="width:8%;">05</td>
          <td style="width:12%;">生效日期</td>
          <td class="arial-val" style="width:14%;">2026.06.18</td>
          <td style="width:8%;">页码</td>
          <td class="arial-val" style="width:7%;">1/1</td>
        </tr>
      </table>

      <div class="print-page-title">
        <h1>清洗工序生产记录</h1>
      </div>

      <table class="print-table">
        <tr>
          <td style="width:10%;height: 36px;">产品名称</td>
          <td colspan="2">${row.mingcheng || ''}</td>
          <td style="width:12%;">生产批号</td>
          <td colspan="2">${row.pici || ''}</td>
        </tr>
        <tr>
          <td style="height: 36px;">型&nbsp;&nbsp;号</td>
          <td style="width:25%;">${row.xinghao || ''}</td>
          <td style="width:10%;">规&nbsp;&nbsp;格</td>
          <td style="width:15%;">${row.guige || ''}</td>
          <td style="width:10%;">配方号</td>
          <td style="width:15%;">${row.peifang || ''}</td>
        </tr>
        <tr>
          <td style="height: 36px;">生产日期</td>
          
        <td colspan="3" class="left" style="text-align: center;">
            <span class="print-letter-6">&nbsp;年 月 日 时 分</span>
            <span style="padding:0 8px; font-weight:bold;">～</span>
            <span class="print-letter-6">&nbsp;年 月 日 时 分</span>
          </td> 
          
          
          
          <td>班&nbsp;&nbsp;次</td>
          <td></td>
        </tr>
        <tr>
          <td style="height: 36px;">设备编号</td>
          <td></td>
          <td>机台号</td>
          <td></td>
          <td>罐&nbsp;&nbsp;次</td>
          <td></td>
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td colspan="5" class="section-header-top">参数设定</td>
        </tr>
        <tr>
          <td  style="width:25%;height: 36px;">纯化水漂洗时间（min）</td>
          <td  style="width:25%;"></td>
          <td  rowspan="4" style="width:15%;">热风干燥</td>
          <td  style="width:20%;">排湿时间（min）</td>
          <td  ></td>
        </tr>
        <tr>
          <td style="height: 36px;">注射水精洗时间（min）</td>
          <td ></td>
          <td >干燥时间（min）</td>
          <td ></td>
        </tr>
        <tr>
          <td style="height: 36px;">硅化时间（min）</td>
          <td ></td>
          <td >真空时间（min）</td>
          <td ></td>
        </tr>
        <tr>
          <td style="height: 36px;">硅化温度（℃）</td>
          <td ></td>
          <td >循环次数</td>
          <td ></td>
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td colspan="3" rowspan="3" style="width:10%;">除边序号</td>
          ${Array(12).fill('<td colspan="2" style="height: 36px; padding: 2px 4px;"></td>').join('')}
        </tr>
        <tr>
          ${Array(12).fill('<td colspan="2" style="height: 36px; padding: 2px 4px;"></td>').join('')}
        </tr>
        <tr>
          ${Array(12).fill('<td colspan="2" style="height: 36px; padding: 2px 4px;"></td>').join('')}
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td style="height: 36px; padding: 2px 4px;width:15%;">装载量（kg）</td>
          <td style="width:20%;"></td>
          <td style="width:20%;">使用清洗剂/硅油</td>
          <td >批&nbsp;&nbsp;&nbsp;号</td>
          <td >用量（ml）</td>
        </tr>
        <tr>
          <td rowspan="2">清洗开始时间</td>
          <td  rowspan="2"></td>
          <td style="height: 36px;">清洗剂</td>
          <td ></td>
          <td ></td>
        </tr>
        <tr>
          <td style="height: 36px;">乳化硅油</td>
          <td ></td>
          <td ></td>
        </tr>
        <tr>
          <td rowspan="2">清洗结束时间</td>
          <td  rowspan="2"></td>
          <td style="height: 36px;">1000cst硅油</td>
          <td ></td>
          <td ></td>
        </tr>
        <tr>
          <td style="height: 36px;">12500cst硅油</td>
          <td ></td>
          <td ></td>
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td colspan="24" style="padding-left:10px;text-align: left;height: 36px;">
            操作人：<span style="margin-left: 300px;">IPQC复核人：</span>
          </td>
        </tr>
        <tr>
          <td colspan="24"  style="padding-left:10px;text-align: left;height: 36px;">备注：</td>
        </tr>
      </table>
    </div>
  `;
}

/* ========== 模板 H：橡胶车间物料平衡单（双页） ========== */
function renderMaterialBalance(row, idx) {
  const metaHeader = (page) => `
    <table class="print-meta-table">
      <tr>
        <td class="logo-cell" style="width:11%;"><img src="images/logo.png" alt="Aptar Pharma Logo" style="width:80%"></td>
        <td style="width:11%;">记录编号</td>
        <td class="arial-val" style="width:14%;">SOR-SC-013</td>
        <td style="width:8%;">版号</td>
        <td class="arial-val" style="width:8%;">08</td>
        <td style="width:12%;">生效日期</td>
        <td class="arial-val" style="width:14%;">2026.06.22</td>
        <td style="width:8%;">页码</td>
        <td class="arial-val" style="width:7%;">${page}/2</td>
      </tr>
    </table>
  `;

  const pageOne = `
    <div class="page-sheet" data-tpl="materialbalance">
      ${metaHeader('1')}

      <div class="print-page-title">
        <h1>橡胶车间物料平衡单</h1>
      </div>

      <table class="print-table">
        <tr>
          <td style="width:10%;" colspan="3">产品名称</td>
          <td colspan="10">${row.mingcheng || ''}</td>
          <td colspan="4">生产批号</td>
          <td colspan="7">${row.pici || ''}</td>
        </tr>
        <tr>
          <td colspan="3">型&nbsp;&nbsp;号</td>
          <td colspan="7">${row.xinghao || ''}</td>
          <td colspan="3">规&nbsp;&nbsp;格</td>
          <td colspan="4">${row.guige || ''}</td>
          <td colspan="4">合格品入库数量</td>
          <td colspan="3"style="width:10%;"></td>
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td colspan="24" class="section-header-top">（一）压延出片工序物料平衡单</td>
        </tr>
        <tr>
          <td colspan="3" rowspan="2" style="width:12%;">公式</td>
          <td colspan="21" class="left" style="font-size:14px; padding:4px 6px;">物料平衡=（出片重量+废胶重量+取样重量+本批尾料重量）/理论配料重量</td>
        </tr>

        <tr>
          <td colspan="21" class="left" style="font-size:14px; padding:4px 6px;">98.00%≤物料平衡≤100.00%，在此范围内属于正常情况，超出此范围按照偏差情况处理。</td>
        </tr>
        <tr>
          <td colspan="3" style="height: 36px; padding: 2px 4px;">配料重量</br>（kg)</td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;">出片重量</br>（kg)</td>
          <td colspan="4" style="height: 36px; padding: 2px 4px;">废胶量</br>（kg)</td>
          <td colspan="4" style="height: 36px; padding: 2px 4px;">取样量</br>（kg)</td>
          <td colspan="4" style="height: 36px; padding: 2px 4px;">本批尾料</br>（kg)</td>
          <td colspan="4" style="height: 36px; padding: 2px 4px;">物料平衡</br>（%）</td>
          <td colspan="5" style="height: 36px; padding: 2px 4px;">结论（正常/偏差）</td>
        </tr>
        <tr>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="4" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="4" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="4" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="4" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="5" style="height: 36px; padding: 2px 4px;"></td>
        </tr>
        <tr>
          <td colspan="3" style="height: 36px; padding: 2px 4px;">记录人/日期</td>
          <td colspan="8" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="13" style="height: 36px; padding: 2px 4px; text-align:left; padding-left:10px;">备注：</td>
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td colspan="24" class="section-header-top">（二）硫化工序物料平衡单</td>
        </tr>
        <tr>
          <td colspan="3" rowspan="2" style="width:12%;">公式</td>
          <td colspan="21" class="left" style="font-size:14px; padding:4px 6px;">物料平衡=（硫化合格品重量+不合格品重量+取样重量+废边重量+未硫化胶片重量）/领用胶片重量</td>
        </tr>
        <tr>
          <td colspan="21" class="left" style="font-size:14px; padding:4px 6px;">98.00%≤物料平衡≤100.00%，在此范围内属于正常情况，超出此范围按照偏差情况处理。</td>
        </tr>
        <tr>
          <td colspan="3" style="height: 36px; padding: 2px 4px; font-size:14px;">领用胶片重量（kg)</td>
          <td colspan="3" style="height: 36px; padding: 2px 4px; font-size:14px;">硫化合格品重量（kg)</td>
          <td colspan="3" style="height: 36px; padding: 2px 4px; font-size:14px;">不合格品重量（kg)</td>
          <td colspan="3" style="height: 36px; padding: 2px 4px; font-size:14px;">取样重量（kg)</td>
          <td colspan="3" style="height: 36px; padding: 2px 4px; font-size:14px;">废边重量（kg)</td>
          <td colspan="3" style="height: 36px; padding: 2px 4px; font-size:14px;">未硫化胶片重量（kg)</td>
          <td colspan="3" style="height: 36px; padding: 2px 4px; font-size:14px;">物料平衡（%）</td>
          <td colspan="3" style="height: 36px; padding: 2px 4px; font-size:14px;">结论（正常/偏差）</td>
        </tr>
        <tr>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
        </tr>
        <tr>
          <td colspan="3" style="height: 36px; padding: 2px 4px;">记录人/日期</td>
          <td colspan="9" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="12" style="height: 36px; padding: 2px 4px; text-align:left; padding-left:10px;">备注：</td>
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td colspan="24" class="section-header-top">（三）除边工序物料平衡单</td>
        </tr>
        <tr>
          <td colspan="3" rowspan="2" style="width:12%;">公式</td>
          <td colspan="21" class="left" style="font-size:14px; padding:4px 6px;">物料平衡=（除边合格品重量+不合格品重量+取样重量+网边重量）/领用硫化合格品重量</td>
        </tr>
        <tr>
          <td colspan="21" class="left" style="font-size:14px; padding:4px 6px;">98.00%≤物料平衡≤105.00%，在此范围内属于正常情况，超出此范围按照偏差情况处理。</td>
        </tr>
        <tr>
          <td colspan="3" style="height: 36px; padding: 2px 4px; font-size:14px;">领用硫化合格品重量（kg)</td>
          <td colspan="3" style="height: 36px; padding: 2px 4px; font-size:14px;">除边合格品重量（kg)</td>
          <td colspan="3" style="height: 36px; padding: 2px 4px; font-size:14px;">不合格品重量（kg)</td>
          <td colspan="3" style="height: 36px; padding: 2px 4px; font-size:14px;">取样重量（kg)</td>
          <td colspan="3" style="height: 36px; padding: 2px 4px; font-size:14px;">网边重量（kg)</td>
          <td colspan="3" style="height: 36px; padding: 2px 4px; font-size:14px;">物料平衡（%）</td>
          <td colspan="6" style="height: 36px; padding: 2px 4px; font-size:14px;">结论（正常/偏差）</td>
        </tr>
        <tr>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="6" style="height: 36px; padding: 2px 4px;"></td>
        </tr>
        <tr>
          <td colspan="3" style="height: 36px; padding: 2px 4px;">记录人/日期</td>
          <td colspan="9" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="12" style="height: 36px; padding: 2px 4px; text-align:left; padding-left:10px;">备注：</td>
        </tr>
        <tr>
          <td colspan="24" style="padding-left:10px;text-align: left;height: 36px;">注：除边产品含除边隔离液，物料平衡上限为105.00%</td>
        </tr>
      </table>
    </div>
  `;

  const pageTwo = `
    <div class="page-sheet" data-tpl="materialbalance">
      ${metaHeader('2')}

      <table class="print-subtable" style="margin-top:15px;">
        <tr>
          <td colspan="24" class="section-header-top">（四）内包工序物料平衡单</td>
        </tr>
        <tr>
          <td colspan="3" rowspan="2" style="width:12%;">公式</td>
          <td colspan="21" class="left" style="font-size:14px; padding:4px 6px;">物料平衡=（内包合格品重量+不合格品重量+尾料重量+取样重量）/领用除边合格品总重量</td>
        </tr>
        <tr>
          <td colspan="21" class="left" style="font-size:14px; padding:4px 6px;">93.00%≤物料平衡≤100.00%，在此范围内属于正常情况，超出此范围按照偏差情况处理。</td>
        </tr>
        <tr>
          <td colspan="3" style="height: 36px; padding: 2px 4px; font-size:14px;">领用除边合格品重量（kg)</td>
          <td colspan="3" style="height: 36px; padding: 2px 4px; font-size:14px;">内包合格品重量（kg)</td>
          <td colspan="3" style="height: 36px; padding: 2px 4px; font-size:14px;">不合格品重量（kg)</td>
          <td colspan="3" style="height: 36px; padding: 2px 4px; font-size:14px;">尾料重量（kg)</td>
          <td colspan="3" style="height: 36px; padding: 2px 4px; font-size:14px;">取样重量（kg)</td>
          <td colspan="3" style="height: 36px; padding: 2px 4px; font-size:14px;">物料平衡（%）</td>
          <td colspan="6" style="height: 36px; padding: 2px 4px; font-size:14px;">结论（正常/偏差）</td>
        </tr>
        <tr>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="6" style="height: 36px; padding: 2px 4px;"></td>
        </tr>
        <tr>
          <td colspan="3" style="height: 36px; padding: 2px 4px;">记录人/日期</td>
          <td colspan="9" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="12" style="height: 36px; padding: 2px 4px; text-align:left; padding-left:10px;">备注：</td>
        </tr>
        <tr>
          <td colspan="24" class="left" style="font-size:14px; padding:6px 8px;">注：清洗后的产品已烘干，不含除边隔离液及水分，物料平衡下限为93.00%</td>
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td colspan="24" class="section-header-top">（五）批物料平衡单</td>
        </tr>
        <tr>
          <td colspan="3" rowspan="2" style="width:12%;">公式</td>
          <td colspan="21" class="left" style="font-size:14px; padding:4px 6px;">物料平衡=（合格品重量+取样重量+不合格品重量+废料重量+尾料重量重量）/理论投料重量</td>
        </tr>
        <tr>
          <td colspan="21" class="left" style="font-size:14px; padding:4px 6px;">98.00%≤物料平衡≤105.00%，在此范围内属于正常情况，超出此范围按照偏差情况处理。</td>
        </tr>
        <tr>
          <td colspan="3" style="height: 36px; padding: 2px 4px; font-size:14px;">合格品重量（kg）</td>
          <td colspan="3" style="height: 36px; padding: 2px 4px; font-size:14px;">取样重量（kg)</td>
          <td colspan="3" style="height: 36px; padding: 2px 4px; font-size:14px;">不合格品重量（kg)</td>
          <td colspan="3" style="height: 36px; padding: 2px 4px; font-size:14px;">废料重量（kg)</td>
          <td colspan="3" style="height: 36px; padding: 2px 4px; font-size:14px;">尾料重量（包括未硫化胶片重量）（kg)</td>
          <td colspan="3" style="height: 36px; padding: 2px 4px; font-size:14px;">物料平衡（%）</td>
          <td colspan="6" style="height: 36px; padding: 2px 4px; font-size:14px;">结论（正常/偏差）</td>
        </tr>
        <tr>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="3" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="6" style="height: 36px; padding: 2px 4px;"></td>
        </tr>
        <tr>
          <td colspan="3" style="height: 36px; padding: 2px 4px;">记录人/日期</td>
          <td colspan="9" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="12" style="height: 36px; padding: 2px 4px; text-align:left; padding-left:10px;">备注：</td>
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td colspan="24" class="section-header-top">（六）合格率</td>
        </tr>
        <tr>
          <td colspan="3" rowspan="3" style="width:12%;">公式</td>
          <td colspan="21" class="left" style="font-size:14px; padding:4px 6px;">本批产品合格率=（合格品入库数量+取样数量）/（合格品入库数量+取样数量+本批不合格品数量）</td>
        </tr>
        <tr>
          <td colspan="21" class="left" style="font-size:14px; padding:4px 6px;">80.00%≤物料平衡≤100.00%，在此范围内属于正常情况，超出此范围按照偏差情况处理。</td>
        </tr>
        <tr>
          <td colspan="21" class="left" style="font-size:14px; padding:4px 6px;">本批不合格品数量=所有工序不合格品数量总和</td>
        </tr>
        <tr>
          <td colspan="4" style="height: 36px; padding: 2px 4px;">合格品入库数量（个)</td>
          <td colspan="4" style="height: 36px; padding: 2px 4px;">取样数量（个)</td>
          <td colspan="5" style="height: 36px; padding: 2px 4px;">本批不合格品数量（个)</td>
          <td colspan="5" style="height: 36px; padding: 2px 4px;">合格率（%)</td>
          <td colspan="6" style="height: 36px; padding: 2px 4px;">结论（正常/偏差）</td>
        </tr>
        <tr>
          <td colspan="4" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="4" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="5" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="5" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="6" style="height: 36px; padding: 2px 4px;"></td>
        </tr>
        <tr>
          <td colspan="4" style="height: 36px; padding: 2px 4px;">记录人/日期</td>
          <td colspan="4" style="height: 36px; padding: 2px 4px;"></td>
          <td colspan="16" style="height: 36px; padding: 2px 4px; text-align:left; padding-left:10px;">备注：</td>
        </tr>
        <tr>
          <td colspan="24" style="padding-left:10px;text-align: left;height: 36px;">注：硫化工序中整模取样的产品既包含合格品，也包含不合格品，计算合格率时不计入此类取样</td>
        </tr>
      </table>
    </div>
  `;

  return pageOne + pageTwo;
}

/* ========== SOR-SC-050 模板 I：标签打印使用、销毁记录（横向） ========== */
function renderLabelRecord(row, idx) {
  let dataRows = '';
  for (let i = 0; i < 10; i++) {
    dataRows += `
      <tr style="height: 36px;">
        <td colspan="3"></td>
        <td colspan="3"></td>
        <td colspan="3"></td>
        <td colspan="3"></td>
        <td colspan="3"></td>
        <td colspan="3"></td>
        <td colspan="3"></td>
        <td colspan="3"></td>
        <td colspan="3"></td>
        <td colspan="7"></td>
      </tr>
    `;
  }

  return `
    <div class="page-sheet-landscape" data-tpl="labelrecord">
      <table class="print-meta-table">
        <tr>
          <td class="logo-cell" style="width:11%;"><img src="images/logo.png" alt="Aptar Pharma Logo" style="width:80%"></td>
          <td style="width:11%;">记录编号</td>
          <td class="arial-val" style="width:14%;">SOR-SC-050</td>
          <td style="width:8%;">版号</td>
          <td class="arial-val" style="width:8%;">06</td>
          <td style="width:12%;">生效日期</td>
          <td class="arial-val" style="width:14%;">2026.06.22</td>
          <td style="width:8%;">页码</td>
          <td class="arial-val" style="width:7%;">1/1</td>
        </tr>
      </table>

      <div class="print-page-title">
        <h1>标签打印使用、销毁记录</h1>
      </div>

      <table class="print-table">
        <tr style="height: 36px;">
          <td colspan="3">产品名称</td>
          <td colspan="12">${row.mingcheng || ''}</td>
          <td colspan="3">生产批号</td>
          <td colspan="5">${row.pici || ''}</td>
          <td colspan="2">型&nbsp;&nbsp;号</td>
          <td colspan="9" style="width:12%;">${row.xinghao || ''}</td>
        </tr>
        <tr style="height: 36px;">
          <td colspan="3">规&nbsp;&nbsp;格</td>
          <td colspan="12">${row.guige || ''}</td>
          <td colspan="3">配 方 号</td>
          <td colspan="5">${row.peifang || ''}</td>
          <td colspan="2">产&nbsp;&nbsp;量</td>
          <td colspan="9"></td>
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr style="height: 36px;">
          <td colspan="3">标签类型</td>
          <td colspan="3">标示数量</td>
          <td colspan="3">打印数量</td>
          <td colspan="3">打印人/日期</td>
          <td colspan="3">复核人/日期</td>
          <td colspan="3">使用数量</td>
          <td colspan="3">销毁数量</td>
          <td colspan="3">销毁人/日期</td>
          <td colspan="3">监销人/日期</td>
          <td colspan="7">备注</td>
        </tr>
        ${dataRows}
      </table>
    </div>
  `;
}

/* ========== 模板 J：外包工序生产记录（横向） ========== */
function renderOutsourcingRecord(row, idx) {
  return `
    <div class="page-sheet-landscape" data-tpl="outsourcingrecord">
      <table class="print-meta-table">
        <tr>
          <td class="logo-cell" style="width:11%;"><img src="images/logo.png" alt="Aptar Pharma Logo" style="width:80%"></td>
          <td style="width:11%;">记录编号</td>
          <td class="arial-val" style="width:14%;">SOR-SC-053</td>
          <td style="width:8%;">版号</td>
          <td class="arial-val" style="width:8%;">06</td>
          <td style="width:12%;">生效日期</td>
          <td class="arial-val" style="width:14%;">2026.06.22</td>
          <td style="width:8%;">页码</td>
          <td class="arial-val" style="width:7%;">1/1</td>
        </tr>
      </table>

      <div class="print-page-title">
        <h1>外包工序生产记录</h1>
      </div>

      <table class="print-table">
        <tr style="height: 36px;">
          <td colspan="3" style="height: 45px;">产品名称</td>
          <td colspan="15">${row.mingcheng || ''}</td>
          <td colspan="3">生产批号</td>
          <td colspan="4">${row.pici || ''}</td>
          <td colspan="3">型&nbsp;&nbsp;号</td>
          <td colspan="8">${row.xinghao || ''}</td>
        </tr>
        <tr style="height: 36px;">
          <td colspan="3" style="height: 45px;">规&nbsp;&nbsp;格</td>
          <td colspan="4">${row.guige || ''}</td>
          <td colspan="3">配 方 号</td>
          <td colspan="5">${row.peifang || ''}</td>
          <td colspan="3">生产日期</td>
          <td colspan="18" class="left">
            <span class="print-letter-6">&nbsp;&nbsp;年 月 日 时 分</span>
            <span style="padding:0 8px; font-weight:bold;">～</span>
            <span class="print-letter-6">&nbsp;年 月 日 时 分</span>
          </td>
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td colspan="36" class="section-header-top" style="height: 45px;">生产结束后统计</td>
        </tr>
        <tr style="height: 36px;">
          <td colspan="10">封口机编号<br>（若未使用包装袋，此处划“/”）</td>
          <td colspan="26"></td>
        </tr>
        <tr style="height: 36px;">
          <td colspan="5">包装</td>
          <td colspan="5">领取数</td>
          <td colspan="5">使用数</td>
          <td colspan="5">退库/销毁数</td>
          <td colspan="5">剩余数</td>
          <td colspan="5">箱号</td>
          <td colspan="6">批号<br>（更换批号需写明箱号）</td>
        </tr>
        <tr style="height: 45px;">
          <td colspan="5">包装袋</td>
          <td colspan="5"></td>
          <td colspan="5"></td>
          <td colspan="5"></td>
          <td colspan="5"></td>
          <td colspan="5"></td>
          <td colspan="6"></td>
        </tr>
        <tr style="height: 45px;">
          <td colspan="5">包装箱</td>
          <td colspan="5"></td>
          <td colspan="5"></td>
          <td colspan="5"></td>
          <td colspan="5"></td>
          <td colspan="5"></td>
          <td colspan="6"></td>
        </tr>
        <tr style="height: 45px;">
          <td colspan="36" class="left">入库数量（个）：_________个/箱* _________箱+ _________个/箱（零箱）= _________个</td>
        </tr>
        <tr style="height: 45px;">
          <td colspan="36" style=" font-size:14px; text-align: left;">操作人：</td>
        </tr>
        <tr style="height: 45px;">
          <td colspan="36" style=" font-size:14px; text-align: left;">备注:</td>
        </tr>
      </table>
    </div>
  `;
}

/* ========== SOR-SC-068模板 K：内包工序生产记录 ========== */
function renderInnerPackingRecord(row, idx) {
  return `
    <div class="page-sheet page-two" data-tpl="innerpackingrecord">
      <table class="print-meta-table" style="margin-bottom: 0;">
        <tr>
          <td class="logo-cell" style="width:11%;"><img src="images/logo.png" alt="Aptar Pharma Logo" style="width:80%"></td>
          <td style="width:11%;">记录编号</td>
          <td class="arial-val" style="width:14%;">SOR-SC-068</td>
          <td style="width:8%;">版号</td>
          <td class="arial-val" style="width:8%;">09</td>
          <td style="width:12%;">生效日期</td>
          <td class="arial-val" style="width:14%;">2026.06.22</td>
          <td style="width:8%;">页码</td>
          <td class="arial-val" style="width:7%;">1/1</td>
        </tr>
      </table>

     
  <table style="margin-top: 0;">
  <tr>
<td style="height: 20px; padding: 4px 6px; text-align: center; font-weight: bold;font-size: 18px;">内包工序生产记录</td>
</tr>
  </table>




      <table class="print-table" style="height: 20px; padding: 4px 6px;">
        <tr>
          <td colspan="4">产品名称</td>
          <td colspan="11">${row.mingcheng || ''}</td>
          <td colspan="5">生产批号</td>
          <td colspan="7">${row.pici || ''}</td>
        </tr>
        <tr>
          <td colspan="4">型&nbsp;&nbsp;号</td>
          <td colspan="8">${row.xinghao || ''}</td>
          <td colspan="3">规&nbsp;&nbsp;格</td>
          <td colspan="5">${row.guige || ''}</td>
          <td colspan="3">配 方 号</td>
          <td colspan="4">${row.peifang || ''}</td>
        </tr>
        <tr>
          <td colspan="4">生产日期</td>
          <td colspan="16" class="left">
            <span class="print-letter-6">&nbsp;&nbsp;年 月 日 时 分</span>
            <span style="padding:0 8px; font-weight:bold;">～</span>
            <span class="print-letter-6">&nbsp;年 月 日 时 分</span>
          </td>
          <td colspan="3">班&nbsp;&nbsp;次</td>
          <td colspan="4"></td>
        </tr>
        <tr>
          <td colspan="4">清洗机台</td>
          <td colspan="8"></td>
          <td colspan="3">灯检机编号</td>
          <td colspan="5"></td>
          <td colspan="3">清洗罐次</td>
          <td colspan="4"></td>
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td colspan="27" style="height: 20px; padding: 4px 6px; text-align: center; font-weight: bold;font-size: 14px;">生产参数确认</td>
        </tr>
        <tr>
          <td colspan="3" rowspan="2" style="padding: 2px 4px;">包装袋</td>
          <td rowspan="2" style="padding: 2px 4px;">封口机编号</td>
          <td colspan="6" style="padding: 2px 4px;">加热挡位</td>
          <td colspan="7">冷却挡位</td>
          <td colspan="10" rowspan="2">使用批号（更换批号需写明袋号/箱号，若未使用划“/”）</td>
        </tr>
        <tr>
          <td colspan="3" style="padding: 2px 4px;">设定值</td>
          <td colspan="3">显示值</td>
          <td colspan="4">设定值</td>
          <td colspan="3">显示值</td>
        </tr>
        <tr>
          <td colspan="3" style="padding: 2px 4px;">内袋</td>
          <td colspan="1"></td>
          <td colspan="3"></td>
          <td colspan="3"></td>
          <td colspan="4"></td>
          <td colspan="3"></td>
          <td colspan="10"></td>
        </tr>
        <tr>
          <td colspan="3" style="padding: 2px 4px;">中袋</td>
          <td colspan="1"></td>
          <td colspan="3"></td>
          <td colspan="3"></td>
          <td colspan="4"></td>
          <td colspan="3"></td>
          <td colspan="10"></td>
        </tr>
        <tr>
          <td colspan="3" style="padding: 2px 4px;">外袋</td>
          <td colspan="1"></td>
          <td colspan="3"></td>
          <td colspan="3"></td>
          <td colspan="4"></td>
          <td colspan="3"></td>
          <td colspan="10"></td>
        </tr>
        <tr>
          <td colspan="7" style="padding: 2px 4px;">灯检机挑战实验</td>
          <td colspan="20" class="left">&nbsp; □合格&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; □不合格</td>
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
           <td colspan="27" style="height: 20px; padding: 4px 6px; text-align: center; font-weight: bold;font-size: 14px;">首件检验及生产过程自检</td>
        </tr>
           
         <tr>
          <td colspan="9"  style="width:35%;padding: 2px 4px;">检验时间</td>
          <td colspan="3"  style="padding: 2px 4px;"></td>
          <td colspan="3"  style="padding: 2px 4px;"></td>
          <td colspan="3"  style="padding: 2px 4px;"></td>
          <td colspan="3"  style="padding: 2px 4px;"></td>
          <td colspan="3"  style="padding: 2px 4px;"></td>
          <td colspan="3"  style="padding: 2px 4px;"></td>
        </tr>     

        
        <tr>
          <td colspan="9" rowspan="2" style="width:35%;padding: 2px 4px;">检验内容</td>
          <td colspan="3" rowspan="2" style="padding: 2px 4px;">□首件检验<br/>□过程自检</td>
          <td colspan="3" rowspan="2" style="padding: 2px 4px;">□首件检验<br/>□过程自检</td>
          <td colspan="3" rowspan="2" style="padding: 2px 4px;">□首件检验<br/>□过程自检</td>
          <td colspan="3" rowspan="2" style="padding: 2px 4px;">□首件检验<br/>□过程自检</td>
          <td colspan="3" rowspan="2" style="padding: 2px 4px;">□首件检验<br/>□过程自检</td>
          <td colspan="3" rowspan="2" style="padding: 2px 4px;">□首件检验<br/>□过程自检</td>
        </tr>
        <tr></tr>
        <tr>
          <td colspan="9" rowspan="2" class="left" style="font-size:12px; line-height:1.4; text-align:left; padding:4px 6px;">1.包装袋应洁净，无破损、油污、杂质、水汽，封口平整严密，一次成型；包装数量准确。</td>
          <td colspan="3" rowspan="2" style="padding:2px 4px;">□合&nbsp;格<br/>□不合格</td>
          <td colspan="3" rowspan="2" style="padding:2px 4px;">□合&nbsp;格<br/>□不合格</td>
          <td colspan="3" rowspan="2" style="padding:2px 4px;">□合&nbsp;格<br/>□不合格</td>
          <td colspan="3" rowspan="2" style="padding:2px 4px;">□合&nbsp;格<br/>□不合格</td>
          <td colspan="3" rowspan="2" style="padding:2px 4px;">□合&nbsp;格<br/>□不合格</td>
          <td colspan="3" rowspan="2" style="padding:2px 4px;">□合&nbsp;格<br/>□不合格</td>
        </tr>
        <tr></tr>
        <tr>
          <td colspan="9" rowspan="2" class="left" style="font-size:12px; line-height:1.4; text-align:left; padding:4px 6px;">2.标签应字迹清晰、内容完整、无脏污、破损,信息与《批生产指令》一致。</td>
          <td colspan="3" rowspan="2" style="padding:2px 4px;">□合&nbsp;格<br/>□不合格</td>
          <td colspan="3" rowspan="2" style="padding:2px 4px;">□合&nbsp;格<br/>□不合格</td>
          <td colspan="3" rowspan="2" style="padding:2px 4px;">□合&nbsp;格<br/>□不合格</td>
          <td colspan="3" rowspan="2" style="padding:2px 4px;">□合&nbsp;格<br/>□不合格</td>
          <td colspan="3" rowspan="2" style="padding:2px 4px;">□合&nbsp;格<br/>□不合格</td>
          <td colspan="3" rowspan="2" style="padding:2px 4px;">□合&nbsp;格<br/>□不合格</td>
        </tr>
        <tr></tr>
        <tr>
          <td colspan="27"  style="font-size:14px; padding:2px 4px; line-height:1.4;text-align: left;">注：在更换规格、更换批号后需进行首件检验。正常生产后每2小时对产品进行一次过程自检。</td>
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td colspan="3">电子秤编号</td>
          <td colspan="7"></td>
          <td colspan="17" class="left" style="width:30%;">产品单重:_____g/个</td>
        </tr>
        <tr>
          <td colspan="3" rowspan="4">包装方式</td>
          <td colspan="24" style= "text-align: left;padding:2px 4px;" >&nbsp; □ SBS：______个/内袋，______内袋/中袋，______中袋/外袋</td>
        </tr>
        <tr>
          <td colspan="24" style= "text-align: left;padding:2px 4px;">&nbsp; □ DH1：______个/内袋，______内袋/外袋</td>
        </tr>
        <tr>
          <td colspan="24" style= "text-align: left;padding:2px 4px;">&nbsp; □ TP3：______个/内袋，______内袋/外袋</td>
        </tr>
        <tr>
          <td colspan="24" style= "text-align: left;padding:2px 4px;">&nbsp; □ 其他方式____________________________________</td>
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td colspan="27" style="height: 20px; padding: 4px 6px; text-align: center; font-weight: bold;font-size: 14px;">生产结束后统计</td>
        </tr>
        <tr>
          <td colspan="5" rowspan="2" style="width:15%;">上班尾料<br>（个）</td>
          <td colspan="3" rowspan="2" style="width:12%;"></td>
          <td colspan="2" rowspan="8">取样量</td>
          <td colspan="17" style= "text-align: left;padding:2px 4px;">性能测试（按批次）________个/包*________包</td>
        </tr>
        <tr>
          <td colspan="17" style= "text-align: left;padding:2px 4px;">细菌内毒素（按批次）________个/包*________包</td>
        </tr>
        <tr>
          <td colspan="5" rowspan="2">本班尾料<br>（个）</td>
          <td colspan="3" rowspan="2"></td>
          <td colspan="17" style= "text-align: left;padding:2px 4px;">不溶性微粒（按罐次）________个/包*________包</td>
        </tr>
        <tr>
          <td colspan="17" style= "text-align: left;padding:2px 4px;">微生物（按班/罐次）________个/包*________包</td>
        </tr>
        <tr>
          <td colspan="5" rowspan="2">发货样包数量<br>（个）</td>
          <td colspan="3" rowspan="2"></td>
          <td colspan="17" style= "text-align: left;padding:2px 4px;">硅油量（按罐次）________个/包*________包</td>
        </tr>
        <tr>
          <td colspan="17" style= "text-align: left;padding:2px 4px;">外观检验（按班/罐次）________个/包*________包</td>
        </tr>
        <tr>
          <td colspan="5" rowspan="2">不合格品数量<br>（个）</td>
          <td colspan="3" rowspan="2"></td>
          <td colspan="17" style= "text-align: left;padding:2px 4px;">留样（按批次）________个/包*________包</td>
        </tr>
        <tr>
          <td colspan="17" style= "text-align: left;padding:2px 4px;">其他 _______________________________________</td>
        </tr>
        <tr>
          <td colspan="5" style= "text-align: center;padding:2px 4px;">出货数量</td>
          <td colspan="22" style= "text-align: left;padding:2px 4px;">&nbsp; ________个/大包* ________大包+ ________个/大包（零包），箱号________</td>
        </tr>
        <tr>
          <td colspan="5" style= "text-align: center;padding:2px 4px;">产量</td>
          <td colspan="22" style= "text-align: left;padding:2px 4px;">&nbsp; ________（产量=出货数量-上罐尾料+本罐尾料+发货样包量+取样量</td>
        </tr>
        <tr>
          <td colspan="27"  style= "text-align: left;padding:2px 4px;">不合格品做集中废弃处理：&nbsp;&nbsp; □是&nbsp;&nbsp; □否</td>
        </tr>
        <tr>
          <td colspan="27" style=" font-size:14px; text-align: left;">操作人：&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;生产复核人：</td>
        </tr>
        <tr>
          <td colspan="27" style=" font-size:14px; text-align: left;">备注:</td>
        </tr>
      </table>
    </div>
  `;
}

/* ========== 模板 L：配料工序清场记录（双页） ========== */
function renderBatchingCleanup(row, idx) {
  const metaTable = (page) => `
    <table class="print-meta-table">
      <tr>
        <td class="logo-cell" style="width:11%;"><img src="images/logo.png" alt="Aptar Pharma Logo" style="width:80%"></td>
        <td style="width:11%;">记录编号</td>
        <td class="arial-val" style="width:14%;">SOR-SC-079</td>
        <td style="width:8%;">版号</td>
        <td class="arial-val" style="width:8%;">01</td>
        <td style="width:12%;">生效日期</td>
        <td class="arial-val" style="width:14%;">2026.06.22</td>
        <td style="width:8%;">页码</td>
        <td class="arial-val" style="width:7%;">${page}/2</td>
      </tr>
    </table>
  `;

  const infoRows = `
    <table class="print-table">
      <tr>
        <td colspan="3">产品名称</td>
        <td colspan="10">${row.mingcheng || ''}</td>
        <td colspan="4">生产批号</td>
        <td colspan="6">${row.pici || ''}</td>
        <td></td>
      </tr>
      <tr>
        <td colspan="3">型&nbsp;&nbsp;号</td>
        <td colspan="8">${row.xinghao || ''}</td>
        <td colspan="2">规&nbsp;&nbsp;格</td>
        <td colspan="4">${row.guige || ''}</td>
        <td colspan="3">配 方 号</td>
        <td colspan="3">${row.peifang || ''}</td>
        <td style="width:10%;"></td>
      </tr>
      <tr>
        <td colspan="3">清场时间</td>
        <td colspan="20" class="left">
          <span class="print-letter-6">&nbsp;&nbsp;年 月 日 时 分</span>
          <span style="padding:0 8px; font-weight:bold;">～</span>
          <span class="print-letter-6">&nbsp;年 月 日 时 分</span>
        </td>
        <td></td>
      </tr>
    </table>
  `;

  const headerRow = `
    <table class="print-subtable" style="margin-top:-1px;">
      <tr>
        <td colspan="2">序号</td>
        <td colspan="4">清场内容</td>
        <td colspan="12">清场要求</td>
        <td colspan="6" style="width:20%;">完成情况</td>
        
      </tr>
  `;

  const pageOne = `
    <div class="page-sheet" data-tpl="batchingcleanup">
      ${metaTable('1')}
      <div class="print-page-title">
        <h1>配料工序清场记录（前清场）</h1>
      </div>
      ${infoRows}
      ${headerRow}
      <tr>
        <td colspan="2">1</td>
        <td colspan="4" rowspan="2">文件/记录/标签/标识</td>
        <td colspan="12" style="text-align: left;">清理与本批无关的文件/记录/标签</td>
        <td colspan="6">□合格 □不合格</td>
        
      </tr>
      <tr>
        <td colspan="2">2</td>
        <td colspan="12" style="text-align: left;">物料、设备、料筒标识完整、清晰、不重叠</td>
        <td colspan="6">□合格 □不合格</td>
       
      </tr>
      <tr>
        <td colspan="2">3</td>
        <td colspan="4">物料</td>
        <td colspan="12" style="text-align: left;">原辅料按批指令领取、双人复核确认</td>
        <td colspan="6">□合格 □不合格</td>
        
      </tr>
      <tr>
        <td colspan="2">4</td>
        <td colspan="4" rowspan="2">设备清洁</td>
        <td colspan="4">切胶机</td>
        <td colspan="8" style="text-align: left;">切胶机导辊、表面无异物、粉尘</td>
        <td colspan="6">□合格 □不合格</td>
        
      </tr>
      <tr>
        <td colspan="2" >5</td>
        <td colspan="4" >电子秤</td>
        <td colspan="8" style="text-align: left;">电子秤使用标准砝码校准正常，台面洁净、无异物、粉尘</td>
        <td colspan="6" >□合格 □不合格</td>
        
      </tr>
      
      <tr>
        <td colspan="2" >6</td>
        <td colspan="4" rowspan="5">容器具清洁</td>
        <td colspan="4" >料桶</td>
        <td colspan="8" style="text-align: left;">所有原辅料容器干净，无异物、粉尘，标识正确</td>
        <td colspan="6" >□合格 □不合格</td>
        
      </tr>
    
      <tr>
        <td colspan="2">7</td>
        <td colspan="4">料铲</td>
        <td colspan="8" style="text-align: left;">洁净、无异物、粉尘</td>
        <td colspan="6">□合格 □不合格</td>
        
      </tr>
      <tr>
        <td colspan="2">8</td>
        <td colspan="4">工具车</td>
        <td colspan="8" style="text-align: left;">洁净、无异物、粉尘</td>
        <td colspan="6">□合格 □不合格</td>
        
      </tr>
      <tr>
        <td colspan="2">9</td>
        <td colspan="4">货架</td>
        <td colspan="8" style="text-align: left;">物料存放架干净，无异物、粉尘</td>
        <td colspan="6">□合格 □不合格</td>
        
      </tr>
      <tr>
        <td colspan="2">10</td>
        <td colspan="4">吸尘罩</td>
        <td colspan="8" style="text-align: left;">吸尘罩帘子干净，无异物、粉尘</td>
        <td colspan="6">□合格 □不合格</td>
        
      </tr>
      <tr>
        <td colspan="2" >11</td>
        <td colspan="4" rowspan="2">环境清洁</td>
        <td colspan="4" >工作台面</td>
        <td colspan="8" style="text-align: left;">清洁消毒，清除与本批无关的文件/记录/产品，无杂物</td>
        <td colspan="6" >□合格 □不合格</td>
        
      </tr>
     
      <tr>
        <td colspan="2">12</td>
        <td colspan="4">生产现场、地面</td>
        <td colspan="8" style="text-align: left;">清除地面的粉尘及脏污，保持现场整洁</td>
        <td colspan="6">□合格 □不合格</td>
        
      </tr>
      <tr>
        <td colspan="2" >13</td>
        <td colspan="4" >清洁状态标识更新</td>
        <td colspan="12" style="text-align: left;">清场结束后，将清洁标识更新为“已清洁”</td>
        <td colspan="6" >□合格 □不合格</td>
        
      </tr>
    
      <tr>
        <td colspan="3">操作人</td>
        <td colspan="9"></td>
        <td colspan="4">生产复核人</td>
        <td colspan="8"></td>
        
      </tr>
      <tr>
        <td colspan="3" rowspan="2">备注</td>
        <td colspan="21" rowspan="2"></td>
       
      </tr>
     
    </table>
    </div>
  `;

  const pageTwo = `
    <div class="page-sheet" data-tpl="batchingcleanup">
      ${metaTable('2')}
      <div class="print-page-title">
        <h1>配料工序清场记录（后清场）</h1>
      </div>
      ${infoRows}
      ${headerRow}
       <tr>
        <td colspan="2">1</td>
        <td colspan="4" rowspan="2">文件/记录/标签/标识</td>
        <td colspan="12" style="text-align: left;">清理与本批无关的文件/记录/标签</td>
        <td colspan="6">□合格 □不合格</td>
        
      </tr>
      <tr>
        <td colspan="2">2</td>
        <td colspan="12" style="text-align: left;">物料、设备、料筒标识完整、清晰、不重叠</td>
        <td colspan="6">□合格 □不合格</td>
       
      </tr>
      <tr>
        <td colspan="2">3</td>
        <td colspan="4">物料</td>
        <td colspan="12" style="text-align: left;">原辅料按批指令领取、双人复核确认</td>
        <td colspan="6">□合格 □不合格</td>
        
      </tr>
      <tr>
        <td colspan="2">4</td>
        <td colspan="4" rowspan="2">设备清洁</td>
        <td colspan="4">切胶机</td>
        <td colspan="8" style="text-align: left;">切胶机导辊、表面无异物、粉尘</td>
        <td colspan="6">□合格 □不合格</td>
        
      </tr>
      <tr>
        <td colspan="2" >5</td>
        <td colspan="4" >电子秤</td>
        <td colspan="8" style="text-align: left;">电子秤使用标准砝码校准正常，台面洁净、无异物、粉尘</td>
        <td colspan="6" >□合格 □不合格</td>
        
      </tr>
      
      <tr>
        <td colspan="2" >6</td>
        <td colspan="4" rowspan="5">容器具清洁</td>
        <td colspan="4" >料桶</td>
        <td colspan="8" style="text-align: left;">所有原辅料容器干净，无异物、粉尘，标识正确</td>
        <td colspan="6" >□合格 □不合格</td>
        
      </tr>
    
      <tr>
        <td colspan="2">7</td>
        <td colspan="4">料铲</td>
        <td colspan="8" style="text-align: left;">洁净、无异物、粉尘</td>
        <td colspan="6">□合格 □不合格</td>
        
      </tr>
      <tr>
        <td colspan="2">8</td>
        <td colspan="4">工具车</td>
        <td colspan="8" style="text-align: left;">洁净、无异物、粉尘</td>
        <td colspan="6">□合格 □不合格</td>
        
      </tr>
      <tr>
        <td colspan="2">9</td>
        <td colspan="4">货架</td>
        <td colspan="8" style="text-align: left;">物料存放架干净，无异物、粉尘</td>
        <td colspan="6">□合格 □不合格</td>
        
      </tr>
      <tr>
        <td colspan="2">10</td>
        <td colspan="4">吸尘罩</td>
        <td colspan="8" style="text-align: left;">吸尘罩帘子干净，无异物、粉尘</td>
        <td colspan="6">□合格 □不合格</td>
        
      </tr>
      <tr>
        <td colspan="2" >11</td>
        <td colspan="4" rowspan="2">环境清洁</td>
        <td colspan="4" >工作台面</td>
        <td colspan="8" style="text-align: left;">清洁消毒，清除与本批无关的文件/记录/产品，无杂物</td>
        <td colspan="6" >□合格 □不合格</td>
        
      </tr>
     
      <tr>
        <td colspan="2">12</td>
        <td colspan="4">生产现场、地面</td>
        <td colspan="8" style="text-align: left;">清除地面的粉尘及脏污，保持现场整洁</td>
        <td colspan="6">□合格 □不合格</td>
        
      </tr>
      <tr>
        <td colspan="2" >13</td>
        <td colspan="4" >清洁状态标识更新</td>
        <td colspan="12" style="text-align: left;">清场结束后，将清洁标识更新为“已清洁”</td>
        <td colspan="6" >□合格 □不合格</td>
        
      </tr>
    
      <tr>
        <td colspan="3">操作人</td>
        <td colspan="9"></td>
        <td colspan="4">生产复核人</td>
        <td colspan="8"></td>
        
      </tr>
      <tr>
        <td colspan="3" rowspan="2">备注</td>
        <td colspan="21" rowspan="2"></td>
       
      </tr>
     
    </table>
    </div>
  `;

  return pageOne + pageTwo;
}

/* ========== 模板 M：密炼工序清场记录 ========== */
function renderMixingCleanup(row, idx) {
  return `
    <div class="page-sheet" data-tpl="mixingcleanup">
      <table class="print-meta-table">
        <tr>
          <td class="logo-cell" style="width:11%;"><img src="images/logo.png" alt="Aptar Pharma Logo" style="width:80%"></td>
          <td style="width:11%;">记录编号</td>
          <td class="arial-val" style="width:14%;">SOR-SC-080</td>
          <td style="width:8%;">版号</td>
          <td class="arial-val" style="width:8%;">01</td>
          <td style="width:12%;">生效日期</td>
          <td class="arial-val" style="width:14%;">2026.06.22</td>
          <td style="width:8%;">页码</td>
          <td class="arial-val" style="width:7%;">1/1</td>
        </tr>
      </table>

      <div class="print-page-title">
        <h1>密炼工序清场记录</h1>
      </div>

      <table class="print-table">
        <tr>
          <td colspan="3">产品名称</td>
          <td colspan="10">${row.mingcheng || ''}</td>
          <td colspan="3">生产批号</td>
          <td colspan="4">${row.pici || ''}</td>

        </tr>
        <tr>
          <td colspan="3">型&nbsp;&nbsp;号</td>
          <td colspan="7">${row.xinghao || ''}</td>
          <td colspan="3">规&nbsp;&nbsp;格</td>
          <td colspan="3">${row.guige || ''}</td>
          <td colspan="3">配 方 号</td>
          <td >${row.peifang || ''}</td>
        
        </tr>
        <tr>
          <td colspan="3">清场时间</td>
          <td colspan="19" class="left">
            <span class="print-letter-6">&nbsp;&nbsp;年 月 日 时 分</span>
            <span style="padding:0 8px; font-weight:bold;">～</span>
            <span class="print-letter-6">&nbsp;年 月 日 时 分</span>
          </td>
          
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td colspan="2">序号</td>
          <td colspan="4">清场内容</td>
          <td colspan="11">清场要求</td>
          <td colspan="5" style="width:20%;">完成情况</td>
          
        </tr>
        <tr>
          <td colspan="2">1</td>
          <td colspan="4" rowspan="2">文件/记录/标签/标识</td>
          <td colspan="11" style="text-align: left;">清理与本批无关的文件/记录/标签</td>
          <td colspan="5">□合格 □不合格</td>
        
        </tr>
        <tr>
          <td colspan="2">2</td>
          <td colspan="11" style="text-align: left;">物料、设备标识完整、清晰</td>
          <td colspan="5">□合格 □不合格</td>
        
        </tr>
        <tr>
          <td colspan="2">3</td>
          <td colspan="4" rowspan="7">设备清洁</td>
          <td colspan="3" rowspan="6">密炼机</td>
          <td colspan="8" style="text-align: left;">密炼机混炼室无粉尘/积垢/胶屑/油污等</td>
          <td colspan="5">□合格 □不合格</td>
       
        </tr>
        <tr>
          <td colspan="2">4</td>
          <td colspan="8" style="text-align: left;">上顶栓无粘附胶料</td>
          <td colspan="5">□合格 □不合格</td>
       
        </tr>
        <tr>
          <td colspan="2">5</td>
          <td colspan="8" style="text-align: left;">转子及缝隙无残留物料</td>
          <td colspan="5">□合格 □不合格</td>
         
        </tr>
        <tr>
          <td colspan="2">6</td>
          <td colspan="8" style="text-align: left;">投料口无残留物料</td>
          <td colspan="5">□合格 □不合格</td>
         
        </tr>
        <tr>
          <td colspan="2">7</td>
          <td colspan="8" style="text-align: left;">设备周边地面无散落的物料</td>
          <td colspan="5">□合格 □不合格</td>
        
        </tr>
        <tr>
          <td colspan="2">8</td>
          <td colspan="8" style="text-align: left;">清理密炼机下方两侧接粉盒</td>
          <td colspan="5">□合格 □不合格</td>
       
        </tr>
        <tr>
          <td colspan="2">9</td>
          <td colspan="3">提升机料斗</td>
          <td colspan="8" style="text-align: left;">提升机料斗内无粉尘/胶屑/油污等</td>
          <td colspan="5">□合格 □不合格</td>
       
        </tr>
        <tr>
          <td colspan="2">10</td>
          <td colspan="4" rowspan="2">环境清洁</td>
          <td colspan="3">工作台面</td>
          <td colspan="8" style="text-align: left;">清洁消毒，清除与本批无关的文件/记录/产品，无杂物</td>
          <td colspan="5">□合格 □不合格</td>
         
        </tr>
        <tr>
          <td colspan="2">11</td>
          <td colspan="3">生产现场、地面</td>
          <td colspan="8" style="text-align: left;">清除地面的落地胶料和粉尘</td>
          <td colspan="5">□合格 □不合格</td>
       
        </tr>
        <tr>
          <td colspan="2">12</td>
          <td colspan="4">状态标识更新</td>
          <td colspan="11" style="text-align: left;">清场结束后，将清洁状态标识更新为“已清洁”</td>
          <td colspan="5">□合格 □不合格</td>
         
        </tr>
        <tr>
          <td colspan="3">操作人</td>
          <td colspan="8"></td>
          <td colspan="3">IPQC复核人</td>
          <td colspan="8"></td>
       
        </tr>
        <tr>
          <td colspan="3">备注</td>
          <td colspan="19"></td>
       
        </tr>
      </table>
    </div>
  `;
}

/* ========== 模板 N：压延出片工序清场记录 ========== */
function renderCalenderingCleanup(row, idx) {
  return `
    <div class="page-sheet" data-tpl="calenderingcleanup">
      <table class="print-meta-table">
        <tr>
          <td class="logo-cell" style="width:11%;"><img src="images/logo.png" alt="Aptar Pharma Logo" style="width:80%"></td>
          <td style="width:11%;">记录编号</td>
          <td class="arial-val" style="width:14%;">SOR-SC-081</td>
          <td style="width:8%;">版号</td>
          <td class="arial-val" style="width:8%;">01</td>
          <td style="width:12%;">生效日期</td>
          <td class="arial-val" style="width:14%;">2026.06.22</td>
          <td style="width:8%;">页码</td>
          <td class="arial-val" style="width:7%;">1/1</td>
        </tr>
      </table>

      <div class="print-page-title">
        <h1>压延出片工序清场记录</h1>
      </div>

      <table class="print-table">
        <tr>
          <td colspan="3">产品名称</td>
          <td colspan="9">${row.mingcheng || ''}</td>
          <td colspan="4">生产批号</td>
          <td colspan="6">${row.pici || ''}</td>
          
        </tr>
        <tr>
          <td colspan="3">型&nbsp;&nbsp;号</td>
          <td colspan="7">${row.xinghao || ''}</td>
          <td colspan="2">规&nbsp;&nbsp;格</td>
          <td colspan="4">${row.guige || ''}</td>
          <td colspan="3">配 方 号</td>
          <td colspan="3">${row.peifang || ''}</td>
         
        </tr>
        <tr>
          <td colspan="3">清场时间</td>
          <td colspan="19" class="left">
            <span class="print-letter-6">&nbsp;&nbsp;年 月 日 时 分</span>
            <span style="padding:0 8px; font-weight:bold;">～</span>
            <span class="print-letter-6">&nbsp;年 月 日 时 分</span>
          </td>
         
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td colspan="2">序号</td>
          <td colspan="3" style="width:15%;">清场内容</td>
          <td colspan="12">清场要求</td>
          <td colspan="5" style="width:20%;">完成情况</td>
         
        </tr>
        <tr>
          <td colspan="2">1</td>
          <td colspan="3" rowspan="2">文件/记录/标签/标识</td>
          <td colspan="12" style="text-align: left;">清理与本批无关的文件/记录/标签</td>
          <td colspan="5">□合格 □不合格</td>
        
        </tr>
        <tr>
          <td colspan="2">2</td>
          <td colspan="12" style="text-align: left;">物料、设备标识完整、清晰</td>
          <td colspan="5">□合格 □不合格</td>
         
        </tr>
        <tr>
          <td colspan="2">3</td>
          <td colspan="3" rowspan="14">设备清洁</td>
          <td colspan="4" rowspan="4" style="width:12%;">四辊压延机</td>
          <td colspan="8" style="text-align: left;">翻胶辊表面洁净，无粉尘/胶屑/油污等</td>
          <td colspan="5">□合格 □不合格</td>
         
        </tr>
        <tr>
          <td colspan="2">4</td>
          <td colspan="8" style="text-align: left;">压延机上方旁辊/压辊表面洁净，无粉尘/胶屑/油污等</td>
          <td colspan="5">□合格 □不合格</td>
         
        </tr>
        <tr>
          <td colspan="2">5</td>
          <td colspan="8" style="text-align: left;">接胶盘表面洁净，无粉尘/胶屑/油污等</td>
          <td colspan="5">□合格 □不合格</td>
        
        </tr>
        <tr>
          <td colspan="2">6</td>
          <td colspan="8" style="text-align: left;">压延机裁刀表面洁净，无粉尘/异物/胶屑/油污/生锈/卷边等</td>
          <td colspan="5">□合格 □不合格</td>
         
        </tr>
        <tr>
          <td colspan="2">7</td>
          <td colspan="4" rowspan="4">八辊冷却机</td>
          <td colspan="8" style="text-align: left;">胶片牵引辊表面洁净，无粉尘/异物/胶屑/油污等</td>
          <td colspan="5">□合格 □不合格</td>
          
        </tr>
        <tr>
          <td colspan="2">8</td>
          <td colspan="8" style="text-align: left;">冷却辊表面洁净，无粉尘/异物/胶屑/油污等</td>
          <td colspan="5">□合格 □不合格</td>
         
        </tr>
        <tr>
          <td colspan="2">9</td>
          <td colspan="8" style="text-align: left;">底盘表面洁净，无粉尘/异物/胶屑/油污等</td>
          <td colspan="5">□合格 □不合格</td>
        
        </tr>
        <tr>
          <td colspan="2">10</td>
          <td colspan="8" style="text-align: left;">链条护板表面洁净，无粉尘/异物/胶屑/油污等</td>
          <td colspan="5">□合格 □不合格</td>
         
        </tr>
        <tr>
          <td colspan="2">11</td>
          <td colspan="4" rowspan="3">冷却输送装置</td>
          <td colspan="8" style="text-align: left;">万向轮表面洁净，无粉尘/异物/胶屑/油污等</td>
          <td colspan="5">□合格 □不合格</td>
      
        </tr>
        <tr>
          <td colspan="2">12</td>
          <td colspan="8" style="text-align: left;">1#传送带表面表面洁净，无粉尘/异物/胶屑/油污等</td>
          <td colspan="5">□合格 □不合格</td>
        
        </tr>
        <tr>
          <td colspan="2">13</td>
          <td colspan="8" style="text-align: left;">2#传送带表面洁净，无粉尘/胶屑/油污等</td>
          <td colspan="5">□合格 □不合格</td>
        
        </tr>
        <tr>
          <td colspan="2">14</td>
          <td colspan="4">裁断机</td>
          <td colspan="8" style="text-align: left;">裁刀表面洁净，无粉尘/异物/胶屑/油污/生锈/卷边等</td>
          <td colspan="5">□合格 □不合格</td>
        
        </tr>
        <tr>
          <td colspan="2">15</td>
          <td colspan="4">金属检测机</td>
          <td colspan="8" style="text-align: left;">传送带表面洁净，无粉尘/异物/胶屑/油污等</td>
          <td colspan="5">□合格 □不合格</td>
         
        </tr>
        <tr>
          <td colspan="2">16</td>
          <td colspan="4">动态称重机</td>
          <td colspan="8" style="text-align: left;">传送带表面洁净，无粉尘/异物/胶屑/油污等</td>
          <td colspan="5">□合格 □不合格</td>
       
        </tr>
        <tr>
          <td colspan="2">17</td>
          <td colspan="3">工器具清洁</td>
          <td colspan="4">剪刀、测厚仪、卡尺、塞规等</td>
          <td colspan="8" style="text-align: left;">工器具表面擦拭干净，无粉尘/异物/胶屑/油污等</td>
          <td colspan="5">□合格 □不合格</td>
        
        </tr>
        <tr>
          <td colspan="2">18</td>
          <td colspan="3" rowspan="2">环境清洁</td>
          <td colspan="4">工作包装台面</td>
          <td colspan="8" style="text-align: left;">清洁消毒，清除与本批无关的文件/记录/产品，无杂物</td>
          <td colspan="5">□合格 □不合格</td>
       
        </tr>
        <tr>
          <td colspan="2">19</td>
          <td colspan="4">生产现场、地面</td>
          <td colspan="8" style="text-align: left;">清除地面的产品</td>
          <td colspan="5">□合格 □不合格</td>
          
        </tr>
        <tr>
          <td colspan="2">20</td>
          <td colspan="3">状态标识更新</td>
          <td colspan="12" style="text-align: left;">清场结束后，将清洁状态标识更新为“已清洁”</td>
          <td colspan="5">□合格 □不合格</td>
        
        </tr>
        <tr>
          <td colspan="3">操作人</td>
          <td colspan="8"></td>
          <td colspan="2">IPQC复核人</td>
          <td colspan="9"></td>
        
        </tr>
        <tr>
          <td colspan="3">备注</td>
          <td colspan="19"></td>
        
        </tr>
      </table>
    </div>
  `;
}

/* ========== 模板 O：硫化工序清场记录（双页） ========== */
function renderVulcanizingCleanup(row, idx) {
  const metaTable = (page) => `
    <table class="print-meta-table">
      <tr>
        <td class="logo-cell" style="width:11%;"><img src="images/logo.png" alt="Aptar Pharma Logo" style="width:80%"></td>
        <td style="width:11%;">记录编号</td>
        <td class="arial-val" style="width:14%;">SOR-SC-082</td>
        <td style="width:8%;">版号</td>
        <td class="arial-val" style="width:8%;">01</td>
        <td style="width:12%;">生效日期</td>
        <td class="arial-val" style="width:14%;">2026.06.22</td>
        <td style="width:8%;">页码</td>
        <td class="arial-val" style="width:7%;">${page}/2</td>
      </tr>
    </table>
  `;

  const infoRows = `
    <table class="print-table">
      <tr>
        <td colspan="3">产品名称</td>
        <td colspan="10">${row.mingcheng || ''}</td>
        <td colspan="4">生产批号</td>
        <td colspan="7">${row.pici || ''}</td>
      </tr>
      <tr>
        <td colspan="3">型&nbsp;&nbsp;号</td>
        <td colspan="8">${row.xinghao || ''}</td>
        <td colspan="2">规&nbsp;&nbsp;格</td>
        <td colspan="4">${row.guige || ''}</td>
        <td colspan="3">配 方 号</td>
        <td colspan="4">${row.peifang || ''}</td>
      </tr>
      <tr>
        <td colspan="3">清场时间</td>
        <td colspan="21" class="left">
          <span class="print-letter-6">&nbsp;&nbsp;年 月 日 时 分</span>
          <span style="padding:0 8px; font-weight:bold;">～</span>
          <span class="print-letter-6">&nbsp;年 月 日 时 分</span>
        </td>
      </tr>
    </table>
  `;

  const headerRow = `
    <table class="print-subtable" style="margin-top:-1px;">
      <tr>
        <td colspan="2">序号</td>
        <td colspan="4">清场内容</td>
        <td colspan="13">清场要求</td>
        <td colspan="5" style="width:20%;">完成情况</td>
      </tr>
  `;

  const pageOne = `
    <div class="page-sheet" data-tpl="vulcanizingcleanup">
      ${metaTable('1')}
      <div class="print-page-title">
        <h1>硫化工序清场记录（前清场）</h1>
      </div>
      ${infoRows}
      ${headerRow}
      <tr>
        <td colspan="2">1</td>
        <td colspan="4" rowspan="2">文件/记录/标签/标识</td>
        <td colspan="13" style="text-align: left;">清理与本批无关的文件/记录/标签</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">2</td>
        <td colspan="13" style="text-align: left;">物料、设备标识完整、清晰</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">3</td>
        <td colspan="4" rowspan="3">物料</td>
        <td colspan="13" style="text-align: left;">领取的胶片批次正确，无混料</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">4</td>
        <td colspan="13" style="text-align: left;">确认乳化硅油比例及有效日期</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">5</td>
        <td colspan="13" style="text-align: left;">确认脱模剂型号</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">6</td>
        <td colspan="4">工艺参数</td>
        <td colspan="13" style="text-align: left;">工艺卡与设备设定的工艺核对确认</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">7</td>
        <td colspan="4">设备清洁</td>
        <td colspan="13" style="text-align: left;">设备表面无油污、灰尘、胶屑、异物等</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">8</td>
        <td colspan="4" rowspan="2">工器具清洁</td>
        <td colspan="5">台面工具盒</td>
        <td colspan="8" style="text-align: left;">无与本批次有关的产品</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">9</td>
        <td colspan="5">灯检冲切器、垫板</td>
        <td colspan="8" style="text-align: left;">灯检冲切器锋利，垫板表面平整光滑</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">10</td>
        <td colspan="4">环境清洁</td>
        <td colspan="5">生产现场、地面</td>
        <td colspan="8" style="text-align: left;">清除地面的产品，保持现场整洁</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">11</td>
        <td colspan="4">状态标识更新</td>
        <td colspan="13" style="text-align: left;">清场结束后，将清洁状态标识更新为“已清洁”</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="3">操作人</td>
        <td colspan="8"></td>
        <td colspan="4">生产复核人</td>
        <td colspan="9"></td>
      </tr>
      <tr>
        <td colspan="3" rowspan="2">备注</td>
        <td colspan="21" rowspan="2"></td>
      </tr>
      <tr></tr>
    </table>
    </div>
  `;

  const pageTwo = `
    <div class="page-sheet" data-tpl="vulcanizingcleanup">
      ${metaTable('2')}
      <div class="print-page-title">
        <h1>硫化工序清场记录（后清场）</h1>
      </div>
      ${infoRows}
      ${headerRow}
      <tr>
        <td colspan="2">1</td>
        <td colspan="4" rowspan="2">文件/记录/标签/标识</td>
        <td colspan="13" style="text-align: left;">清理与本批无关的文件/记录/标签</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">2</td>
        <td colspan="13" style="text-align: left;">物料、设备标识完整、清晰</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">3</td>
        <td colspan="4" rowspan="2">物料</td>
        <td colspan="13" style="text-align: left;">剩余胶片处理，填写物料结存卡</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">4</td>
        <td colspan="13" style="text-align: left;">脱模剂、乳化硅油</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">5</td>
        <td colspan="4">计量工具</td>
        <td colspan="13" style="text-align: left;">电子秤、钢直尺、测温仪归位</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">6</td>
        <td colspan="4">设备清洁</td>
        <td colspan="13" style="text-align: left;">设备表面无油污、灰尘、胶屑、异物等</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">7</td>
        <td colspan="4" rowspan="2">工器具清洁</td>
        <td colspan="5">台面工具盒</td>
        <td colspan="8" style="text-align: left;">无与本批次有关的产品</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">8</td>
        <td colspan="5">灯检冲切器、垫板</td>
        <td colspan="8" style="text-align: left;">灯检冲切器锋利，垫板表面平整光滑</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">9</td>
        <td colspan="4">环境清洁</td>
        <td colspan="5">生产现场、地面</td>
        <td colspan="8" style="text-align: left;">清除地面的产品，保持现场整洁</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">10</td>
        <td colspan="4">状态标识更新</td>
        <td colspan="13" style="text-align: left;">清场结束后，将清洁状态标识更新为“已清洁”</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="3">操作人</td>
        <td colspan="8"></td>
        <td colspan="4">生产复核人</td>
        <td colspan="9"></td>
      </tr>
      <tr>
        <td colspan="3" rowspan="2">备注</td>
        <td colspan="21" rowspan="2"></td>
      </tr>
      <tr></tr>
    </table>
    </div>
  `;

  return pageOne + pageTwo;
}

/* ========== 模板 P：除边工序清场记录（双页） ========== */
function renderTrimmingCleanup(row, idx) {
  const metaTable = (page) => `
    <table class="print-meta-table">
      <tr>
        <td class="logo-cell" style="width:11%;"><img src="images/logo.png" alt="Aptar Pharma Logo" style="width:80%"></td>
        <td style="width:11%;">记录编号</td>
        <td class="arial-val" style="width:14%;">SOR-SC-083</td>
        <td style="width:8%;">版号</td>
        <td class="arial-val" style="width:8%;">01</td>
        <td style="width:12%;">生效日期</td>
        <td class="arial-val" style="width:14%;">2026.06.22</td>
        <td style="width:8%;">页码</td>
        <td class="arial-val" style="width:7%;">${page}/2</td>
      </tr>
    </table>
  `;

  const infoRows = `
    <table class="print-table">
      <tr>
        <td colspan="3">产品名称</td>
        <td colspan="10">${row.mingcheng || ''}</td>
        <td colspan="3">生产批号</td>
        <td colspan="6">${row.pici || ''}</td>
       
      </tr>
      <tr>
        <td colspan="3">型&nbsp;&nbsp;号</td>
        <td colspan="8">${row.xinghao || ''}</td>
        <td colspan="2">规&nbsp;&nbsp;格</td>
        <td colspan="3">${row.guige || ''}</td>
        <td colspan="3">配 方 号</td>
        <td colspan="3">${row.peifang || ''}</td>
     
      </tr>
      <tr>
        <td colspan="3">清场时间</td>
        <td colspan="19" class="left">
          <span class="print-letter-6">&nbsp;&nbsp;年 月 日 时 分</span>
          <span style="padding:0 8px; font-weight:bold;">～</span>
          <span class="print-letter-6">&nbsp;年 月 日 时 分</span>
        </td>
     
      </tr>
    </table>
  `;

  const headerRow = `
    <table class="print-subtable" style="margin-top:-1px;">
      <tr>
        <td colspan="2">序号</td>
        <td colspan="4" style="width:15%;">清场内容</td>
        <td colspan="11">清场要求</td>
        <td colspan="5" style="width:20%;">完成情况</td>
       
      </tr>
  `;

  const pageOne = `
    <div class="page-sheet" data-tpl="trimmingcleanup">
      ${metaTable('1')}
      <div class="print-page-title">
        <h1>除边工序清场记录（前清场）</h1>
      </div>
      ${infoRows}
      ${headerRow}
      <tr>
        <td colspan="2">1</td>
        <td colspan="4" rowspan="2">文件/记录/标签/标识</td>
        <td colspan="11" style="text-align: left;">清理与本批无关的文件/记录/标签</td>
        <td colspan="5">□合格 □不合格</td>
      
      </tr>
      <tr>
        <td colspan="2">2</td>
        <td colspan="11" style="text-align: left;">物料、设备标识完整、清晰</td>
        <td colspan="5">□合格 □不合格</td>
      
      </tr>
      <tr>
        <td colspan="2">3</td>
        <td colspan="4" rowspan="3">物料</td>
        <td colspan="11" style="text-align: left;">领取的胶片批次正确，无混料</td>
        <td colspan="5">□合格 □不合格</td>
      
      </tr>
      <tr>
        <td colspan="2">4</td>
        <td colspan="11" style="text-align: left;">液体隔离液干净无污染，并在有效期内</td>
        <td colspan="5">□合格 □不合格</td>
      
      </tr>
      <tr>
        <td colspan="2">5</td>
        <td colspan="11" style="text-align: left;">清洁用75%酒精在有效期内</td>
        <td colspan="5">□合格 □不合格</td>
        
      </tr>
      <tr>
        <td colspan="2">6</td>
        <td colspan="4">计量工具</td>
        <td colspan="11" style="text-align: left;">电子秤在有效期内，使用砝码做日常校准</td>
        <td colspan="5">□合格 □不合格</td>
        
      </tr>
      <tr>
        <td colspan="2">7</td>
        <td colspan="4" rowspan="3">清洁与设备确认</td>
        <td colspan="11" style="text-align: left;">设备表面无油污、灰尘、异物等，出料口无污染，确认设备接油盒状态，保持清洁。确认除边机行程是否正确</td>
        <td colspan="5">□合格 □不合格</td>
       
      </tr>
      <tr>
        <td colspan="2">8</td>
        <td colspan="11" style="text-align: left;">将除边模具使用纯化水冲洗干净</td>
        <td colspan="5">□合格 □不合格</td>
        
      </tr>
      <tr>
        <td colspan="2">9</td>
        <td colspan="11" style="text-align: left;">接料筐内无产品，且保持清洁无污染</td>
        <td colspan="5">□合格 □不合格</td>
       
      </tr>
      <tr>
        <td colspan="2">10</td>
        <td colspan="4">环境清洁</td>
        <td colspan="11" style="text-align: left;">生产现场、地面无产品，保持现场整洁</td>
        <td colspan="5">□合格 □不合格</td>
      
      </tr>
      <tr>
        <td colspan="2">11</td>
        <td colspan="4">状态标识更新</td>
        <td colspan="11" style="text-align: left;">清场结束后，将清洁状态标识更新为“已清洁”</td>
        <td colspan="5">□合格 □不合格</td>
        
      </tr>
      <tr>
        <td colspan="3">操作人</td>
        <td colspan="8"></td>
        <td colspan="2" style="width:15%;">生产复核人</td>
        <td colspan="9"></td>
        
      </tr>
      <tr>
        <td colspan="3" >备注</td>
        <td colspan="19" ></td>
       
      </tr>
     
    </table>
    </div>
  `;

  const pageTwo = `
    <div class="page-sheet" data-tpl="trimmingcleanup">
      ${metaTable('2')}
      <div class="print-page-title">
        <h1>除边工序清场记录（后清场）</h1>
      </div>
      ${infoRows}
      ${headerRow}
      <tr>
        <td colspan="2">1</td>
        <td colspan="4" rowspan="2">文件/记录/标签/标识</td>
        <td colspan="11" style="text-align: left;">清理与本批无关的文件/记录/标签</td>
        <td colspan="5">□合格 □不合格</td>
       
      </tr>
      <tr>
        <td colspan="2">2</td>
        <td colspan="11" style="text-align: left;">物料、设备标识完整、清晰</td>
        <td colspan="5">□合格 □不合格</td>
        
      </tr>
      <tr>
        <td colspan="2">3</td>
        <td colspan="4" rowspan="2">物料</td>
        <td colspan="11" style="text-align: left;">除边后的产品在中转区定置存放</td>
        <td colspan="5">□合格 □不合格</td>
        
      </tr>
      <tr>
        <td colspan="2">4</td>
        <td colspan="11" style="text-align: left;">液体隔离液处理</td>
        <td colspan="5">□合格 □不合格</td>
       
      </tr>
      <tr>
        <td colspan="2">5</td>
        <td colspan="4" rowspan="3">清洁</td>
        <td colspan="11" style="text-align: left;">设备表面无油污、灰尘、异物等，出料口无污染，清理干净接油盒</td>
        <td colspan="5">□合格 □不合格</td>
       
      </tr>
      <tr>
        <td colspan="2">6</td>
        <td colspan="11" style="text-align: left;">将除边模具使用纯化水冲洗干净</td>
        <td colspan="5">□合格 □不合格</td>
     
      </tr>
      <tr>
        <td colspan="2">7</td>
        <td colspan="11" style="text-align: left;">接料筐内无产品，且保持清洁无污染</td>
        <td colspan="5">□合格 □不合格</td>
    
      </tr>
      <tr>
        <td colspan="2">8</td>
        <td colspan="4">环境清洁</td>
        <td colspan="11" style="text-align: left;">生产现场、地面无产品，保持现场整洁</td>
        <td colspan="5">□合格 □不合格</td>
       
      </tr>
      <tr>
        <td colspan="2">9</td>
        <td colspan="4">状态标识更新</td>
        <td colspan="11" style="text-align: left;">清场结束后，将清洁状态标识更新为“已清洁”</td>
        <td colspan="5">□合格 □不合格</td>
       
      </tr>
      <tr>
        <td colspan="3">操作人</td>
        <td colspan="9" ></td>
        <td  style="width:15%;">生产复核人</td>
        <td colspan="9"></td>
        
      </tr>
      <tr>
        <td colspan="3" >备注</td>
        <td colspan="19" ></td>
       
      </tr>
     
    </table>
    </div>
  `;

  return pageOne + pageTwo;
}
/* ========== SOR-SC-084 清洗工序清场记录（双页） ========== */
function renderWashingCleanup(row, idx) {
  const metaTable = (page) => `
    <table class="print-meta-table">
      <tr>
        <td class="logo-cell" style="width:11%;"><img src="images/logo.png" alt="Aptar Pharma Logo" style="width:80%"></td>
        <td style="width:11%;">记录编号</td>
        <td class="arial-val" style="width:14%;">SOR-SC-084</td>
        <td style="width:8%;">版号</td>
        <td class="arial-val" style="width:8%;">01</td>
        <td style="width:12%;">生效日期</td>
        <td class="arial-val" style="width:14%;">2026.06.22</td>
        <td style="width:8%;">页码</td>
        <td class="arial-val" style="width:7%;">${page}/2</td>
      </tr>
    </table>
  `;

  const infoRows = `
    <table class="print-table">
      <tr>
        <td colspan="3">产品名称</td>
        <td colspan="10">${row.mingcheng || ''}</td>
        <td colspan="4">生产批号</td>
        <td colspan="6">${row.pici || ''}</td>
        
      </tr>
      <tr>
        <td colspan="3">型&nbsp;&nbsp;号</td>
        <td colspan="8">${row.xinghao || ''}</td>
        <td colspan="2">规&nbsp;&nbsp;格</td>
        <td colspan="4">${row.guige || ''}</td>
        <td colspan="3">配 方 号</td>
        <td colspan="3">${row.peifang || ''}</td>
        
      </tr>
      <tr>
        <td colspan="3">清场时间</td>
        <td colspan="20" class="left">
          <span class="print-letter-6">&nbsp;&nbsp;年 月 日 时 分</span>
          <span style="padding:0 8px; font-weight:bold;">～</span>
          <span class="print-letter-6">&nbsp;年 月 日 时 分</span>
        </td>
       
      </tr>
    </table>
  `;

  const headerRow = `
    <table class="print-subtable" style="margin-top:-1px;">
      <tr>
        <td colspan="2">序号</td>
        <td colspan="5">清场内容</td>
        <td colspan="12">清场要求</td>
        <td colspan="5" style="width:20%;">完成情况</td>
      </tr>
  `;

  const pageOne = `
    <div class="page-sheet" data-tpl="washingcleanup">
      ${metaTable('1')}
      <div class="print-page-title">
        <h1>清洗工序清场记录（前清场）</h1>
      </div>
      ${infoRows}
      ${headerRow}
      <tr>
        <td colspan="2">1</td>
        <td colspan="5" rowspan="2">文件/记录/标签/标识</td>
        <td colspan="12" style="text-align: left;">清理与本批无关的文件/记录/标签</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">2</td>
        <td colspan="12" style="text-align: left;">物料、设备标识完整、清晰</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">3</td>
        <td colspan="5" rowspan="3">物料</td>
        <td colspan="12" style="text-align: left;">根据生产指令准备待清洗产品，并确认产品批号规格</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">4</td>
        <td colspan="12" style="text-align: left;">硅油及清洗剂型号正确并在有效期内</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">5</td>
        <td colspan="12" style="text-align: left;">清洁用75%酒精在有效期内</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">6</td>
        <td colspan="5">清洁</td>
        <td colspan="12" style="text-align: left;">设备表面无油污、灰尘等，清洗机放料口无污染</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">7</td>
        <td colspan="5" rowspan="2">环境清洁</td>
        <td colspan="12" style="text-align: left;">量杯、漏勺、漏斗、真空吸管、料铲等干净整洁</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">8</td>
        <td colspan="12" style="text-align: left;">生产现场、地面无产品，保持现场整洁</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">9</td>
        <td colspan="5">状态标识更新</td>
        <td colspan="12" style="text-align: left;">清场结束后，将清洁状态标识更新为“已清洁”</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="3">操作人</td>
        <td colspan="9" style="width:25%;"></td>
        <td colspan="4" style="width:15%;">生产复核人</td>
        <td colspan="8"></td>
      </tr>
      <tr>
        <td colspan="3" rowspan="2">备注</td>
        <td colspan="21" rowspan="2"></td>
      </tr>
      <tr></tr>
    </table>
    </div>
  `;

  const pageTwo = `
    <div class="page-sheet" data-tpl="washingcleanup">
      ${metaTable('2')}
      <div class="print-page-title">
        <h1>清洗工序清场记录（后清场）</h1>
      </div>
      ${infoRows}
      ${headerRow}
      <tr>
        <td colspan="2">1</td>
        <td colspan="5" rowspan="2">文件/记录/标签/标识</td>
        <td colspan="12" style="text-align: left;">清理与本批无关的文件/记录/标签</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">2</td>
        <td colspan="12" style="text-align: left;">物料、设备标识完整、清晰</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">3</td>
        <td colspan="5" rowspan="3">物料</td>
        <td colspan="12" style="text-align: left;">清洗后产品放料</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">4</td>
        <td colspan="12" style="text-align: left;">硅油及清洗剂归位/填写物料结存卡</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">5</td>
        <td colspan="12" style="text-align: left;">清洁用75%酒精在有效期内</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">6</td>
        <td colspan="5" rowspan="3">清洁</td>
        <td colspan="12" style="text-align: left;">设备表面无油污、灰尘、异物等，放料口无污染</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">7</td>
        <td colspan="12" style="text-align: left;">量杯、漏勺、漏斗、真空吸管、料铲等清洁干净后归位，填写清洁记录</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">8</td>
        <td colspan="12" style="text-align: left;">周转筐无产品，且清洁到位，填写清洁记录</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">9</td>
        <td colspan="5" rowspan="3">清洗机内部</td>
        <td colspan="12" style="text-align: left;">确认出料口无任何产品，使用无尘布、75%酒精清洁出料口</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">10</td>
        <td colspan="12" style="text-align: left;">使用内窥镜确认笼内螺旋叶片无任何产品</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">11</td>
        <td colspan="12" style="text-align: left;">使用内窥镜确认喷淋杆及清洗机内其他位置无残留产品</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">12</td>
        <td colspan="5">环境清洁</td>
        <td colspan="12" style="text-align: left;">生产现场、地面无产品，保持现场整洁</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">13</td>
        <td colspan="5">状态标识更新</td>
        <td colspan="12" style="text-align: left;">清场结束后，将清洁状态标识更新为“已清洁”</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="3">操作人</td>
        <td colspan="9" style="width:25%;"></td>
        <td colspan="4" style="width:15%;">生产复核人</td>
        <td colspan="8"></td>
      </tr>
      <tr>
        <td colspan="3" rowspan="2">备注</td>
        <td colspan="21" rowspan="2"></td>
      </tr>
      <tr></tr>
    </table>
    </div>
  `;

  return pageOne + pageTwo;
}

/* ========== SOR-SC-085 内包工序清场记录（双页） ========== */
function renderInnerPackagingCleanup(row, idx) {
  const metaTable = (page) => `
    <table class="print-meta-table">
      <tr>
        <td class="logo-cell" style="width:11%;"><img src="images/logo.png" alt="Aptar Pharma Logo" style="width:80%"></td>
        <td style="width:11%;">记录编号</td>
        <td class="arial-val" style="width:14%;">SOR-SC-085</td>
        <td style="width:8%;">版号</td>
        <td class="arial-val" style="width:8%;">01</td>
        <td style="width:12%;">生效日期</td>
        <td class="arial-val" style="width:14%;">2026.06.22</td>
        <td style="width:8%;">页码</td>
        <td class="arial-val" style="width:7%;">${page}/2</td>
      </tr>
    </table>
  `;

  const infoRows = `
    <table class="print-table">
      <tr>
        <td colspan="3">产品名称</td>
        <td colspan="10">${row.mingcheng || ''}</td>
        <td colspan="4">生产批号</td>
        <td colspan="6">${row.pici || ''}</td>
       
      </tr>
      <tr>
        <td colspan="3">型&nbsp;&nbsp;号</td>
        <td colspan="8">${row.xinghao || ''}</td>
        <td colspan="2">规&nbsp;&nbsp;格</td>
        <td colspan="4">${row.guige || ''}</td>
        <td colspan="3">配 方 号</td>
        <td colspan="4">${row.peifang || ''}</td>
      </tr>
      <tr>
        <td colspan="3">清场时间</td>
        <td colspan="20" class="left">
          <span class="print-letter-6">&nbsp;&nbsp;年 月 日 时 分</span>
          <span style="padding:0 8px; font-weight:bold;">～</span>
          <span class="print-letter-6">&nbsp;年 月 日 时 分</span>
        </td>
        
      </tr>
    </table>
  `;

  const headerRow = `
    <table class="print-subtable" style="margin-top:-1px;">
      <tr>
        <td colspan="2" style="width:10%;">序号</td>
        <td colspan="8">清场内容</td>
        <td colspan="9">清场要求</td>
        <td colspan="5" style="width:25%;">完成情况</td>
      </tr>
  `;

  const pageOne = `
    <div class="page-sheet" data-tpl="innerpackagingcleanup">
      <style>
        [data-tpl="innerpackagingcleanup"] .print-table td,
        [data-tpl="innerpackagingcleanup"] .print-subtable td {
          padding: 5px 7px;
        }
      </style>
      ${metaTable('1')}
      <div class="print-page-title">
        <h1>内包工序清场记录（前清场）</h1>
      </div>
      ${infoRows}
      ${headerRow}
      <tr>
        <td colspan="2">1</td>
        <td colspan="8" rowspan="2">文件/记录/标签/标识</td>
        <td colspan="9" style="text-align: left;">清理与本批无关的文件/记录/标签</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">2</td>
        <td colspan="9" style="text-align: left;">物料、设备标识完整、清晰</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">3</td>
        <td colspan="8">包装袋</td>
        <td colspan="9" style="text-align: left;">分类存放，防止混淆用错；包裹严密，必要时用包装袋封口，确认包装袋在有效期</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">4</td>
        <td colspan="3" rowspan="10">设备清洁</td>
        <td colspan="5">层流罩</td>
        <td colspan="9" style="text-align: left;">软帘悬挂完好，洁净、无杂物，确认层流罩压差表数值是否达标，风向是否正确</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">5</td>
        <td colspan="5">卸料仓下方、上料机传送带及外壳侧面</td>
        <td colspan="9" style="text-align: left;">清除残留产品，擦拭清洁至洁净</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">6</td>
        <td colspan="5">接料提升装置，传送带</td>
        <td colspan="9" style="text-align: left;">清除上料提升机的提升装置卡槽，传送带底部透明玻璃内与本批无关产品，洁净无异物</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">7</td>
        <td colspan="5">振动盘</td>
        <td colspan="9" style="text-align: left;">检查振动盘与轨道连接处，清除与本批无关产品，洁净无异物</td>
        <td colspan="5">□合格 □不合格 □不适用</td>
      </tr>
      <tr>
        <td colspan="2">8</td>
        <td colspan="5">灯检机</td>
        <td colspan="9" style="text-align: left;">清除设备内与本批无关产品，洁净无异物</td>
        <td colspan="5">□合格 □不合格 □不适用</td>
      </tr>
      <tr>
        <td colspan="2">9</td>
        <td colspan="5">灯检机出料口</td>
        <td colspan="9" style="text-align: left;">洁净无异物、无其他规格产品</td>
        <td colspan="5">□合格 □不合格 □不适用</td>
      </tr>
      <tr>
        <td colspan="2">10</td>
        <td colspan="5">金检机及其附属设施</td>
        <td colspan="9" style="text-align: left;">洁净无异物、无其他规格产品</td>
        <td colspan="5">□合格 □不合格 □不适用</td>
      </tr>
      <tr>
        <td colspan="2">11</td>
        <td colspan="5">灯检机不合格品接料容器</td>
        <td colspan="9" style="text-align: left;">清洁消毒、清除与本批无关产品，洁净无异物</td>
        <td colspan="5">□合格 □不合格 □不适用</td>
      </tr>
      <tr>
        <td colspan="2">12</td>
        <td colspan="5">电子秤</td>
        <td colspan="9" style="text-align: left;">电子秤可以正常使用，洁净无异物，使用砝码进行日常校准</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">13</td>
        <td colspan="5">封口机</td>
        <td colspan="9" style="text-align: left;">封口机按钮完好、高温海绵完好，确认参数是否正确</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">14</td>
        <td colspan="3" rowspan="3">容器具清洁</td>
        <td colspan="5">卸料仓</td>
        <td colspan="9" style="text-align: left;">料仓清洁消毒、清除残留产品</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">15</td>
        <td colspan="5">提升装置、振动盘、灯检机及附属设施的清洁</td>
        <td colspan="9" style="text-align: left;">清洁消毒，清除与本批无关的产品，无杂物</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">16</td>
        <td colspan="5">料铲、推料耙、剪刀</td>
        <td colspan="9" style="text-align: left;">洁净、无异物，填写清洁记录</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">17</td>
        <td colspan="3" rowspan="2">环境清洁</td>
        <td colspan="5">工作包装台面</td>
        <td colspan="9" style="text-align: left;">清洁消毒，清除与本批无关的文件/记录/产品，无杂物</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">18</td>
        <td colspan="5">生产现场、地面</td>
        <td colspan="9" style="text-align: left;">确认生产现场、地面整洁</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">19</td>
        <td colspan="8">状态标识更新</td>
        <td colspan="9" style="text-align: left;">清场结束后，将清洁状态标识更新为“已清洁”</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="3">操作人</td>
        <td colspan="7" style="width:25%;"></td>
        <td colspan="3" style="width:15%;">生产复核人</td>
        <td colspan="11"></td>
        
      </tr>
      <tr>
        <td colspan="3" rowspan="2">备注</td>
        <td colspan="21" rowspan="2"></td>
        
      </tr>
      <tr></tr>
    </table>
    </div>
  `;

  const pageTwo = `
    <div class="page-sheet page-two" data-tpl="innerpackagingcleanup">
      <style>
        .page-two .print-table td,
        .page-two .print-subtable td {
          padding: 4.5px 6px;
        }
      </style>
      ${metaTable('2')}
      <div class="print-page-title">
        <h1>内包工序清场记录（后清场）</h1>
      </div>
      ${infoRows}
      ${headerRow}
      <tr>
        <td colspan="2">1</td>
        <td colspan="8" rowspan="2">文件/记录/标签/标识</td>
        <td colspan="9" style="text-align: left;">清理与本批无关的文件/记录/标签</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">2</td>
        <td colspan="9" style="text-align: left;">物料、设备标识完整、清晰</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">3</td>
        <td colspan="8" rowspan="3">物料</td>
        <td colspan="9" style="text-align: left;">所有物料按品种、批次计数称量封口退库；中间产品转交至下道工序</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">4</td>
        <td colspan="9" style="text-align: left;">所有物料及中间产品按批次计数称量后转至物料暂存间。</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">5</td>
        <td colspan="9" style="text-align: left;">做好封口/标识，单独存放</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">6</td>
        <td colspan="8" rowspan="2">包装袋</td>
        <td colspan="9" style="text-align: left;">分类存放，防止混淆用错；包裹严密，必要时用包装袋封口</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">7</td>
        <td colspan="9" style="text-align: left;">做好封口/标识，单独存放</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">8</td>
        <td colspan="3" rowspan="10">设备清洁</td>
        <td colspan="5">层流罩</td>
        <td colspan="9" style="text-align: left;">软帘悬挂完好，洁净无异物</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">9</td>
        <td colspan="5">卸料仓下方、上料机传送带及外壳侧面</td>
        <td colspan="9" style="text-align: left;">清除残留产品，擦拭清洁至洁净</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">10</td>
        <td colspan="5">接料提升装置，传送带</td>
        <td colspan="9" style="text-align: left;">清除接料提升装置卡槽，传送带底部透明玻璃内与本批无关产品</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">11</td>
        <td colspan="5">振动盘</td>
        <td colspan="9" style="text-align: left;">检查振动盘与轨道连接处，清除与本批无关产品</td>
        <td colspan="5">□合格 □不合格 □不适用</td>
      </tr>
      <tr>
        <td colspan="2" >12</td>
        <td colspan="5" >灯检机</td>
        <td colspan="9" style="text-align: left;">清除设备内与本批无关产品</td>
        <td colspan="5">□合格 □不合格 □不适用</td>
      </tr>
      <tr>
        <td colspan="2" >13</td>
        <td colspan="5" >灯检机出料口</td>
        <td colspan="9" style="text-align: left;">洁净、无其他规格产品</td>
        <td colspan="5">□合格 □不合格 □不适用</td>
      </tr>
      <tr>
        <td colspan="2" >14</td>
        <td colspan="5" >金检机及其附属设施</td>
        <td colspan="9" style="text-align: left;">洁净无异物、无其他规格产品</td>
        <td colspan="5">□合格 □不合格 □不适用</td>
      </tr>
      <tr>
        <td colspan="2" >15</td>
        <td colspan="5" >灯检机不合格品接料容器</td>
        <td colspan="9" style="text-align: left;">清洁消毒、清除与本批无关产品</td>
        <td colspan="5">□合格 □不合格 □不适用</td>
      </tr>
      <tr>
        <td colspan="2" >16</td>
        <td colspan="5" >电子秤</td>
        <td colspan="9" style="text-align: left;">电子秤可以正常使用，洁净、无异物</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2" >17</td>
        <td colspan="5" >封口机</td>
        <td colspan="9" style="text-align: left;">封口机按钮完好、高温海绵完好</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2" >18</td>
        <td colspan="3" rowspan="3" >容器具清洁</td>
        <td colspan="5" style="padding: 2px 4px;">卸料仓</td>
        <td colspan="9" style="text-align: left;">料仓清洁消毒、清除残留产品</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">19</td>
        <td colspan="5">提升装置、振动盘、灯检机及附属设施的清洁</td>
        <td colspan="9" style="text-align: left;">清洁消毒，清除与本批无关的产品，无杂物</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">20</td>
        <td colspan="5">料铲/推料耙/剪刀</td>
        <td colspan="9" style="text-align: left;">洁净、无异物，填写清洁记录</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">21</td>
        <td colspan="3" rowspan="2">环境清洁</td>
        <td colspan="5">工作包装台面</td>
        <td colspan="9" style="text-align: left;">清洁消毒，清除与本批无关的文件/记录/产品，无杂物</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">22</td>
        <td colspan="5">生产现场、地面</td>
        <td colspan="9" style="text-align: left;">确认生产现场、地面整洁</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">23</td>
        <td colspan="8">状态标识更新</td>
        <td colspan="9" style="text-align: left;">清场结束后，将清洁状态标识更新为“已清洁”</td>
        <td colspan="5">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="3">操作人</td>
        <td colspan="7" style="width:25%;"></td>
        <td colspan="3" style="width:15%;">生产复核人</td>
        <td colspan="11"></td>
        
      </tr>
      <tr>
        <td colspan="3" rowspan="2">备注</td>
        <td colspan="21" rowspan="2"></td>
        
      </tr>
      <tr></tr>
    </table>
    </div>
  `;

  return pageOne + pageTwo;
}

/* ========== SOR-SC-086 外包工序清场记录（单页） ========== */
function renderOuterPackagingCleanup(row, idx) {
  return `
    <div class="page-sheet" data-tpl="outerpackagingcleanup">
      <table class="print-meta-table">
        <tr>
          <td class="logo-cell" style="width:11%;"><img src="images/logo.png" alt="Aptar Pharma Logo" style="width:80%"></td>
          <td style="width:11%;">记录编号</td>
          <td class="arial-val" style="width:14%;">SOR-SC-086</td>
          <td style="width:8%;">版号</td>
          <td class="arial-val" style="width:8%;">01</td>
          <td style="width:12%;">生效日期</td>
          <td class="arial-val" style="width:14%;">2026.06.22</td>
          <td style="width:8%;">页码</td>
          <td class="arial-val" style="width:7%;">1/1</td>
        </tr>
      </table>

      <div class="print-page-title">
        <h1>外包工序清场记录</h1>
      </div>

      <table class="print-table">
        <tr>
          <td colspan="3">产品名称</td>
          <td colspan="10">${row.mingcheng || ''}</td>
          <td colspan="4">生产批号</td>
          <td colspan="7">${row.pici || ''}</td>
          
        </tr>
        <tr>
          <td colspan="3">型&nbsp;&nbsp;号</td>
          <td colspan="8">${row.xinghao || ''}</td>
          <td colspan="2">规&nbsp;&nbsp;格</td>
          <td colspan="4">${row.guige || ''}</td>
          <td colspan="3">配 方 号</td>
          <td colspan="4">${row.peifang || ''}</td>
        </tr>
        <tr>
          <td colspan="3">清场时间</td>
          <td colspan="21" class="left">
            <span class="print-letter-6">&nbsp;&nbsp;年 月 日 时 分</span>
            <span style="padding:0 8px; font-weight:bold;">～</span>
            <span class="print-letter-6">&nbsp;年 月 日 时 分</span>
          </td>
          
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td colspan="2">序号</td>
          <td colspan="8">清场内容</td>
          <td colspan="9">清场要求</td>
          <td colspan="5" style="width:20%;">完成情况</td>
        </tr>
        <tr>
          <td colspan="2">1</td>
          <td colspan="8">状态标识更新</td>
          <td colspan="9" style="text-align: left;">清场结束后，将清洁状态标识更新为“已清洁”</td>
          <td colspan="5">□合格 □不合格</td>
        </tr>
        <tr>
          <td colspan="2">2</td>
          <td colspan="8">包装袋</td>
          <td colspan="9" style="text-align: left;">包裹严密，必要时用包装袋封口</td>
          <td colspan="5">□合格 □不合格</td>
        </tr>
        <tr>
          <td colspan="2">3</td>
          <td colspan="8">包装箱</td>
          <td colspan="9" style="text-align: left;">包装箱型号正确，完好无损</td>
          <td colspan="5">□合格 □不合格</td>
        </tr>
        <tr>
          <td colspan="2">4</td>
          <td colspan="3">设备清洁</td>
          <td colspan="5">封口机</td>
          <td colspan="9" style="text-align: left;">封口机按钮和加热条完好</td>
          <td colspan="5">□合格 □不合格</td>
        </tr>
        <tr>
          <td colspan="2">5</td>
          <td colspan="3" rowspan="2">环境清洁</td>
          <td colspan="5">工作包装台面</td>
          <td colspan="9" style="text-align: left;">清洁消毒，清除与本批无关的文件/记录/产品，无杂物</td>
          <td colspan="5">□合格 □不合格</td>
        </tr>
        <tr>
          <td colspan="2">6</td>
          <td colspan="5">生产现场、地面</td>
          <td colspan="9" style="text-align: left;">确认生产现场、地面整洁</td>
          <td colspan="5">□合格 □不合格</td>
        </tr>
        <tr>
          <td colspan="2">7</td>
          <td colspan="8" rowspan="2">文件/记录/标签/标识</td>
          <td colspan="9" style="text-align: left;">清理与本批无关的文件/记录/标签</td>
          <td colspan="5">□合格 □不合格</td>
        </tr>
        <tr>
          <td colspan="2">8</td>
          <td colspan="9" style="text-align: left;">物料、设备标识完整、清晰</td>
          <td colspan="5">□合格 □不合格</td>
        </tr>
        <tr>
          <td colspan="3">操作人</td>
          <td colspan="7" style="width:25%;"></td>
          <td colspan="3" style="width:15%;">生产复核人</td>
          <td colspan="11"></td>
          
        </tr>
        <tr>
          <td colspan="3">备注</td>
          <td colspan="21"></td>
         
        </tr>
      </table>
    </div>
  `;
}

/* 模板Y========== SOR-SC-093 清洗工序预清洗清场记录（双页） ========== */
function renderWashingPreCleanup(row, idx) {
  const metaTable = (page) => `
    <table class="print-meta-table">
      <tr>
        <td class="logo-cell" style="width:11%;"><img src="images/logo.png" alt="Aptar Pharma Logo" style="width:80%"></td>
        <td style="width:11%;">记录编号</td>
        <td class="arial-val" style="width:14%;">SOR-SC-093</td>
        <td style="width:8%;">版号</td>
        <td class="arial-val" style="width:8%;">00</td>
        <td style="width:12%;">生效日期</td>
        <td class="arial-val" style="width:14%;">2026.06.22</td>
        <td style="width:8%;">页码</td>
        <td class="arial-val" style="width:7%;">${page}/2</td>
      </tr>
    </table>
  `;

  const infoRows = `
    <table class="print-table">
      <tr>
        <td colspan="3">产品名称</td>
        <td colspan="10">${row.mingcheng || ''}</td>
        <td colspan="4">生产批号</td>
        <td colspan="7">${row.pici || ''}</td>
      </tr>
      <tr>
        <td colspan="3">型&nbsp;&nbsp;号</td>
        <td colspan="8">${row.xinghao || ''}</td>
        <td colspan="2">规&nbsp;&nbsp;格</td>
        <td colspan="4">${row.guige || ''}</td>
        <td colspan="3">配 方 号</td>
        <td colspan="4">${row.peifang || ''}</td>
      </tr>
      <tr>
        <td colspan="3">清场时间</td>
        <td colspan="21" class="left">
          <span class="print-letter-6">&nbsp;&nbsp;年 月 日 时 分</span>
          <span style="padding:0 8px; font-weight:bold;">～</span>
          <span class="print-letter-6">&nbsp;年 月 日 时 分</span>
        </td>
      </tr>
    </table>
  `;

  const headerRow = `
    <table class="print-subtable" style="margin-top:-1px;">
      <tr>
        <td colspan="2">序号</td>
        <td colspan="3">清场内容</td>
        <td colspan="13">清场要求</td>
        <td colspan="6" style="width:20%;">完成情况</td>
      </tr>
  `;

  const pageOne = `
    <div class="page-sheet" data-tpl="washingprecleanup">
      ${metaTable('1')}
      <div class="print-page-title">
        <h1>清洗工序预清洗清场记录（前清场）</h1>
      </div>
      ${infoRows}
      ${headerRow}
      <tr>
        <td colspan="2">1</td>
        <td colspan="3" rowspan="2">文件/记录/标签/标识</td>
        <td colspan="13" style="text-align: left;">清理与本批无关的文件/记录/标签</td>
        <td colspan="6">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">2</td>
        <td colspan="13" style="text-align: left;">物料、设备标识完整、清晰</td>
        <td colspan="6">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">3</td>
        <td colspan="3" rowspan="3">物料</td>
        <td colspan="13" style="text-align: left;">根据生产指令准备待预清洗产品，并确认产品批号规格</td>
        <td colspan="6">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">4</td>
        <td colspan="13" style="text-align: left;">清洗剂型号正确并在有效期内</td>
        <td colspan="6">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">5</td>
        <td colspan="13" style="text-align: left;">清洁用75%酒精在有效期内</td>
        <td colspan="6">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">6</td>
        <td colspan="3">清洁</td>
        <td colspan="13" style="text-align: left;">设备表面无残留产品、胶屑、油污、灰尘、异物等，预清洗机提升装置、振动筛、滚筒、各水箱、放料口等位置无产品、胶屑、异物、油污。检查滚筒内部时，务必使用强光手电。</td>
        <td colspan="6">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">7</td>
        <td colspan="3" rowspan="2">环境清洁</td>
        <td colspan="13" style="text-align: left;">工具车、周转筐等干净整洁</td>
        <td colspan="6">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">8</td>
        <td colspan="13" style="text-align: left;">生产现场、地面无产品，保持现场整洁</td>
        <td colspan="6">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">9</td>
        <td colspan="3">状态标识更新</td>
        <td colspan="13" style="text-align: left;">清场结束后，将清洁状态标识更新为“已清洁”</td>
        <td colspan="6">□合格 □不合格</td>
      </tr>
      <tr>
   
        
        <td colspan="3">操作人</td>
        <td colspan="8" style="width:25%;"></td>
        <td colspan="3" style="width:15%;">生产复核人</td>
        <td colspan="10"></td>
        
      </tr>
      <tr>
        <td colspan="3" rowspan="2">备注</td>
        <td colspan="21" rowspan="2"></td>
      </tr>
      <tr></tr>
    </table>
    </div>
  `;

  const pageTwo = `
    <div class="page-sheet" data-tpl="washingprecleanup">
      ${metaTable('2')}
      <div class="print-page-title">
        <h1>清洗工序预清洗清场记录（后清场）</h1>
      </div>
      ${infoRows}
      ${headerRow}
      <tr>
        <td colspan="2">1</td>
        <td colspan="3" rowspan="2">文件/记录/标签/标识</td>
        <td colspan="13" style="text-align: left;">清理与本批无关的文件/记录/标签</td>
        <td colspan="6">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">2</td>
        <td colspan="13" style="text-align: left;">物料、设备标识完整、清晰</td>
        <td colspan="6">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">3</td>
        <td colspan="3" rowspan="3">物料</td>
        <td colspan="13" style="text-align: left;">清洗后产品放料</td>
        <td colspan="6">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">4</td>
        <td colspan="13" style="text-align: left;">清洗剂归位/填写物料结存卡</td>
        <td colspan="6">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">5</td>
        <td colspan="13" style="text-align: left;">清洁用75%酒精在有效期内</td>
        <td colspan="6">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">6</td>
        <td colspan="3" rowspan="3">清洁</td>
        <td colspan="13" style="text-align: left;">设备表面无残留产品、胶屑、油污、灰尘、异物等，预清洗机提升装置、振动筛、滚筒、各水箱、放料口等位置无产品、胶屑、异物、油污。检查滚筒内部时，务必使用强光手电。</td>
        <td colspan="6">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">7</td>
        <td colspan="13" style="text-align: left;">工具车清洁干净后归位，填写清洁记录</td>
        <td colspan="6">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">8</td>
        <td colspan="13" style="text-align: left;">周转筐无产品，且清洁到位，填写清洁记录</td>
        <td colspan="6">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">9</td>
        <td colspan="3" rowspan="2">预清洗机滚筒内部</td>
        <td colspan="13" style="text-align: left;">确认出料口无任何产品，使用无尘布、75%酒精清洁出料口</td>
        <td colspan="6">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">10</td>
        <td colspan="13" style="text-align: left;">使用强光手电确认滚筒内部无任何产品和胶屑残留</td>
        <td colspan="6">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">11</td>
        <td colspan="3">环境清洁</td>
        <td colspan="13" style="text-align: left;">生产现场、地面无产品，保持现场整洁</td>
        <td colspan="6">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="2">12</td>
        <td colspan="3">状态标识更新</td>
        <td colspan="13" style="text-align: left;">清场结束后，将清洁状态标识更新为“已清洁”</td>
        <td colspan="6">□合格 □不合格</td>
      </tr>
      <tr>
        <td colspan="3">操作人</td>
        <td colspan="8" style="width:25%;"></td>
        <td colspan="3" style="width:15%;">生产复核人</td>
        <td colspan="10"></td>
      </tr>
      <tr>
        <td colspan="3" rowspan="2">备注</td>
        <td colspan="21" rowspan="2"></td>
      </tr>
      <tr></tr>
    </table>
    </div>
  `;

  return pageOne + pageTwo;
}
/* ========== 模板：开炼工序清场记录（1#） SOR-SC-091 ========== */
function renderMixingCleanup1(row, idx) {
  return `
    <div class="page-sheet" data-tpl="mixingcleanup1">
      <table class="print-meta-table">
        <tr>
          <td class="logo-cell" style="width:11%;"><img src="images/logo.png" alt="Aptar Pharma Logo" style="width:80%"></td>
          <td style="width:11%;">记录编号</td>
          <td class="arial-val" style="width:14%;">SOR-SC-091</td>
          <td style="width:8%;">版号</td>
          <td class="arial-val" style="width:8%;">00</td>
          <td style="width:12%;">生效日期</td>
          <td class="arial-val" style="width:14%;">2026.06.22</td>
          <td style="width:8%;">页码</td>
          <td class="arial-val" style="width:7%;">1/1</td>
        </tr>
      </table>

      <div class="print-page-title">
        <h1>开炼工序清场记录（1#）</h1>
      </div>

      <table class="print-table">
        <tr>
          <td colspan="3">产品名称</td>
          <td colspan="10">${row.mingcheng || ''}</td>
          <td colspan="4">生产批号</td>
          <td colspan="7">${row.pici || ''}</td>
        </tr>
        <tr>
          <td colspan="3">型&nbsp;&nbsp;号</td>
          <td colspan="8">${row.xinghao || ''}</td>
          <td colspan="2">规&nbsp;&nbsp;格</td>
          <td colspan="4">${row.guige || ''}</td>
          <td colspan="3">配&nbsp;&nbsp;方</td>
          <td colspan="4">${row.peifang || ''}</td>
        </tr>
        <tr>
          <td colspan="3">清场时间</td>
          <td colspan="21" class="left">
            <span class="print-letter-6">&nbsp;&nbsp;年 月 日 时 分</span>
            <span style="padding:0 8px; font-weight:bold;">～</span>
            <span class="print-letter-6">&nbsp;年 月 日 时 分</span>
          </td>
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td colspan="2">序号</td>
          <td colspan="3">清场内容</td>
          <td colspan="13">清场要求</td>
          <td colspan="6" style="width:20%;">完成情况</td>
        </tr>
        <tr>
          <td colspan="2">1</td>
          <td colspan="3" rowspan="2">文件/记录/标签/标识</td>
          <td colspan="13" style="text-align: left;">清理与本批无关的文件/记录/标签</td>
          <td colspan="6">□合格 □不合格</td>
        </tr>
        <tr>
          <td colspan="2">2</td>
          <td colspan="13" style="text-align: left;">物料、设备标识完整、清晰</td>
          <td colspan="6">□合格 □不合格</td>
        </tr>
        <tr>
          <td colspan="2">3</td>
          <td colspan="3" rowspan="8">设备清洁</td>
          <td colspan="3" rowspan="8">1#开炼机</td>
          <td colspan="10" style="text-align: left;">主机辊筒表面洁净，无粉尘/胶屑/油污等</td>
          <td colspan="6">□合格 □不合格</td>
        </tr>
        <tr>
          <td colspan="2">4</td>
          <td colspan="10" style="text-align: left;">胸压杆表面洁净，无粉尘/胶屑/油污等</td>
          <td colspan="6">□合格 □不合格</td>
        </tr>
        <tr>
          <td colspan="2">5</td>
          <td colspan="10" style="text-align: left;">翻胶辊表面洁净，无粉尘/胶屑/油污等</td>
          <td colspan="6">□合格 □不合格</td>
        </tr>
        <tr>
          <td colspan="2">6</td>
          <td colspan="10" style="text-align: left;">炼胶挡板表面洁净，无粉尘/胶屑/油污等</td>
          <td colspan="6">□合格 □不合格</td>
        </tr>
        <tr>
          <td colspan="2">7</td>
          <td colspan="10" style="text-align: left;">底部接胶盘表面洁净，无粉尘/胶屑/油污等</td>
          <td colspan="6">□合格 □不合格</td>
        </tr>
        <tr>
          <td colspan="2">8</td>
          <td colspan="10" style="text-align: left;">两侧接胶盒/挡胶板表面干净，无粉尘/胶屑/油污等</td>
          <td colspan="6">□合格 □不合格</td>
        </tr>
        <tr>
          <td colspan="2">9</td>
          <td colspan="10" style="text-align: left;">裁刀表面洁净，无粉尘/异物/胶屑/油污/生锈/卷边等</td>
          <td colspan="6">□合格 □不合格</td>
        </tr>
        <tr>
          <td colspan="2">10</td>
          <td colspan="10" style="text-align: left;">提升机传送带表面洁净，无残留粉尘/胶屑</td>
          <td colspan="6">□合格 □不合格</td>
        </tr>
        <tr>
          <td colspan="2">11</td>
          <td colspan="3">容器具清洁</td>
          <td colspan="3">割胶刀</td>
          <td colspan="10" style="text-align: left;">表面无脏污</td>
          <td colspan="6">□合格 □不合格</td>
        </tr>
        <tr>
          <td colspan="2">12</td>
          <td colspan="3" rowspan="2">环境清洁</td>
          <td colspan="3">工作台面</td>
          <td colspan="10" style="text-align: left;">清洁消毒，清除与本批无关的文件/记录/产品，无杂物</td>
          <td colspan="6">□合格 □不合格</td>
        </tr>
        <tr>
          <td colspan="2">13</td>
          <td colspan="3">生产现场、地面</td>
          <td colspan="10" style="text-align: left;">清除地面的落地胶料和粉尘</td>
          <td colspan="6">□合格 □不合格</td>
        </tr>
        <tr>
          <td colspan="2">14</td>
          <td colspan="3">状态标识更新</td>
          <td colspan="13" style="text-align: left;">清场结束后，将清洁状态标识更新为“已清洁”</td>
          <td colspan="6">□合格 □不合格</td>
        </tr>
        <tr>
          <td colspan="3">操作人</td>
          <td colspan="8"></td>
          <td colspan="2">IPQC复核人</td>
          <td colspan="11"></td>
        </tr>
        <tr>
          <td colspan="3">备注</td>
          <td colspan="21"></td>
        </tr>
      </table>
    </div>
  `;
}

/* ========== 模板：开炼工序清场记录（2#） SOR-SC-092 ========== */
function renderMixingCleanup2(row, idx) {
  return `
    <div class="page-sheet" data-tpl="mixingcleanup2">
      <table class="print-meta-table">
        <tr>
          <td class="logo-cell" style="width:11%;"><img src="images/logo.png" alt="Aptar Pharma Logo" style="width:80%"></td>
          <td style="width:11%;">记录编号</td>
          <td class="arial-val" style="width:14%;">SOR-SC-092</td>
          <td style="width:8%;">版号</td>
          <td class="arial-val" style="width:8%;">00</td>
          <td style="width:12%;">生效日期</td>
          <td class="arial-val" style="width:14%;">2026.06.22</td>
          <td style="width:8%;">页码</td>
          <td class="arial-val" style="width:7%;">1/1</td>
        </tr>
      </table>

      <div class="print-page-title">
        <h1>开炼工序清场记录（2#）</h1>
      </div>

      <table class="print-table">
        <tr>
          <td colspan="3">产品名称</td>
          <td colspan="10">${row.mingcheng || ''}</td>
          <td colspan="4">生产批号</td>
          <td colspan="7">${row.pici || ''}</td>
        </tr>
        <tr>
          <td colspan="3">型&nbsp;&nbsp;号</td>
          <td colspan="8">${row.xinghao || ''}</td>
          <td colspan="2">规&nbsp;&nbsp;格</td>
          <td colspan="4">${row.guige || ''}</td>
          <td colspan="3">配&nbsp;&nbsp;方</td>
          <td colspan="4">${row.peifang || ''}</td>
        </tr>
        <tr>
          <td colspan="3">清场时间</td>
          <td colspan="21" class="left">
            <span class="print-letter-6">&nbsp;&nbsp;年 月 日 时 分</span>
            <span style="padding:0 8px; font-weight:bold;">～</span>
            <span class="print-letter-6">&nbsp;年 月 日 时 分</span>
          </td>
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td colspan="2">序号</td>
          <td colspan="3">清场内容</td>
          <td colspan="13">清场要求</td>
          <td colspan="6" style="width:20%;">完成情况</td>
        </tr>
        <tr>
          <td colspan="2">1</td>
          <td colspan="3" rowspan="2">文件/记录/标签/标识</td>
          <td colspan="13" style="text-align: left;">清理与本批无关的文件/记录/标签</td>
          <td colspan="6">□合格 □不合格</td>
        </tr>
        <tr>
          <td colspan="2">2</td>
          <td colspan="13" style="text-align: left;">物料、设备标识完整、清晰</td>
          <td colspan="6">□合格 □不合格</td>
        </tr>
        <tr>
          <td colspan="2">3</td>
          <td colspan="3" rowspan="8">设备清洁</td>
          <td colspan="3" rowspan="8">2#开炼机</td>
          <td colspan="10" style="text-align: left;">主机辊筒表面洁净，无粉尘/胶屑/油污等</td>
          <td colspan="6">□合格 □不合格</td>
        </tr>
        <tr>
          <td colspan="2">4</td>
          <td colspan="10" style="text-align: left;">胸压杆表面洁净，无粉尘/胶屑/油污等</td>
          <td colspan="6">□合格 □不合格</td>
        </tr>
        <tr>
          <td colspan="2">5</td>
          <td colspan="10" style="text-align: left;">翻胶辊表面洁净，无粉尘/胶屑/油污等</td>
          <td colspan="6">□合格 □不合格</td>
        </tr>
        <tr>
          <td colspan="2">6</td>
          <td colspan="10" style="text-align: left;">炼胶挡板表面洁净，无粉尘/胶屑/油污等</td>
          <td colspan="6">□合格 □不合格</td>
        </tr>
        <tr>
          <td colspan="2">7</td>
          <td colspan="10" style="text-align: left;">底部接胶盘表面洁净，无粉尘/胶屑/油污等</td>
          <td colspan="6">□合格 □不合格</td>
        </tr>
        <tr>
          <td colspan="2">8</td>
          <td colspan="10" style="text-align: left;">两侧接胶盒/挡胶板表面干净，无粉尘/胶屑/油污等</td>
          <td colspan="6">□合格 □不合格</td>
        </tr>
        <tr>
          <td colspan="2">9</td>
          <td colspan="10" style="text-align: left;">裁刀表面洁净，无粉尘/异物/胶屑/油污/生锈/卷边等</td>
          <td colspan="6">□合格 □不合格</td>
        </tr>
        <tr>
          <td colspan="2">10</td>
          <td colspan="10" style="text-align: left;">提升机传送带表面洁净，无残留粉尘/胶屑</td>
          <td colspan="6">□合格 □不合格</td>
        </tr>
        <tr>
          <td colspan="2">11</td>
          <td colspan="3">容器具清洁</td>
          <td colspan="3">割胶刀</td>
          <td colspan="10" style="text-align: left;">表面无脏污</td>
          <td colspan="6">□合格 □不合格</td>
        </tr>
        <tr>
          <td colspan="2">12</td>
          <td colspan="3" rowspan="2">环境清洁</td>
          <td colspan="3">工作台面</td>
          <td colspan="10" style="text-align: left;">清洁消毒，清除与本批无关的文件/记录/产品，无杂物</td>
          <td colspan="6">□合格 □不合格</td>
        </tr>
        <tr>
          <td colspan="2">13</td>
          <td colspan="3">生产现场、地面</td>
          <td colspan="10" style="text-align: left;">清除地面的落地胶料和粉尘</td>
          <td colspan="6">□合格 □不合格</td>
        </tr>
        <tr>
          <td colspan="2">14</td>
          <td colspan="3">状态标识更新</td>
          <td colspan="13" style="text-align: left;">清场结束后，将清洁状态标识更新为“已清洁”</td>
          <td colspan="6">□合格 □不合格</td>
        </tr>
        <tr>
          <td colspan="3">操作人</td>
          <td colspan="8"></td>
          <td colspan="2">IPQC复核人</td>
          <td colspan="11"></td>
        </tr>
        <tr>
          <td colspan="3">备注</td>
          <td colspan="21"></td>
        </tr>
      </table>
    </div>
  `;
}
/* 生产记录模板渲染函数（批次二：开炼1#/2#、试样硫化） */

function __emptyCells(n) {
  return '<td></td>'.repeat(n);
}

function __col2Cells(n) {
  return '<td colspan="2"></td>'.repeat(n);
}

/* ========== SOR-SC-087 开炼工序生产记录（1#）A4 landscape ========== */
function renderMixingProduction1(row, idx) {
  return `
    <div class="page-sheet-landscape" data-tpl="mixingproduction1">
      <table class="print-meta-table">
        <tr>
          <td class="logo-cell" style="width:11%;"><img src="images/logo.png" alt="Aptar Pharma Logo" style="width:80%"></td>
          <td style="width:11%;">记录编号</td>
          <td class="arial-val" style="width:14%;">SOR-SC-087</td>
          <td style="width:8%;">版号</td>
          <td class="arial-val" style="width:8%;">00</td>
          <td style="width:12%;">生效日期</td>
          <td class="arial-val" style="width:14%;">2026.06.22</td>
          <td style="width:8%;">页码</td>
          <td class="arial-val" style="width:7%;">1/1</td>
        </tr>
      </table>

      <div class="print-page-title">
        <h1>开炼工序生产记录（1#）</h1>
      </div>

      <table class="print-table">
        <tr>
          <td colspan="3">产品名称</td>
          <td colspan="15">${row.mingcheng || ''}</td>
          <td colspan="3">生产批号</td>
          <td colspan="2">${row.pici || ''}</td>
          <td colspan="3">型&nbsp;&nbsp;号</td>
          <td colspan="6">${row.xinghao || ''}</td>
         
        </tr>
        <tr>
          <td colspan="3">规&nbsp;&nbsp;格</td>
          <td colspan="4">${row.guige || ''}</td>
          <td colspan="2">配 方 号</td>
          <td colspan="3">${row.peifang || ''}</td>
          <td colspan="3">生产日期</td>
          <td colspan="13" class="left">
            <span class="print-letter-6">年 月 日 时 分</span>
            <span style="padding:0 8px; font-weight:bold;">～</span>
            <span class="print-letter-6">年 月 日 时 分</span>
          </td>
          <td colspan="2">班&nbsp;&nbsp;次</td>
          <td colspan="2" style="width:12%;"></td>
         
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td colspan="33" class="section-header-top">生产参数确认</td>
        </tr>
        <tr>
          <td colspan="10">设备编号</td>
          <td colspan="7">压缩空气（kg/cm<sup>2</sup>）</td>
          <td colspan="7">循环水压（Mpa）</td>
          <td colspan="8">冷却水温（℃）</td>
         
        </tr>
        <tr>
          <td colspan="10" class="arial-val">XS-KLJ-01</td>
          <td colspan="7"></td>
          <td colspan="7"></td>
          <td colspan="8"></td>
          
        </tr>
        <tr>
          <td colspan="3">步骤</td>
          <td colspan="7">辊距（mm）</td>
          <td colspan="7">时间（s）</td>
          <td colspan="7">主机速度（m/min）</td>
          <td colspan="8">翻料速度（m/min）</td>
          
        </tr>
        <tr>
          <td colspan="3">炼胶</td>
          <td colspan="7"></td>
          <td colspan="7">/</td>
          <td colspan="7"></td>
          <td colspan="8"></td>
          
        </tr>
        <tr>
          <td colspan="3">翻胶</td>
          <td colspan="7"></td>
          <td colspan="7"></td>
          <td colspan="7"></td>
          <td colspan="8"></td>
         
        </tr>
        <tr>
          <td colspan="3">出片</td>
          <td colspan="7"></td>
          <td colspan="7">/</td>
          <td colspan="7"></td>
          <td colspan="8"></td>
         
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td colspan="33" class="section-header-top">生产操作确认</td>
        </tr>
        <tr>
          <td colspan="5" style="width:15%;">车数</td>
          ${__emptyCells(28)}
        </tr>
        <tr>
          <td colspan="5">完成相应的操作步骤后在车数对应的空格打“√”</td>
          ${__emptyCells(28)}
        </tr>
        <tr>
          <td colspan="5">实测出料温度（℃）</td>
          ${__emptyCells(28)}
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td colspan="33" style="padding-left:10px; text-align: left;">操作人：</td>
        </tr>
        <tr>
          <td colspan="33" style="padding-left:10px; text-align: left;">备注：</td>
        </tr>
      </table>
    </div>
  `;
}

/* ========== SOR-SC-088 开炼工序生产记录（2#）A4 landscape ========== */
function renderMixingProduction2(row, idx) {
  return `
    <div class="page-sheet-landscape" data-tpl="mixingproduction2">
      <table class="print-meta-table">
        <tr>
          <td class="logo-cell" style="width:11%;"><img src="images/logo.png" alt="Aptar Pharma Logo" style="width:80%"></td>
          <td style="width:11%;">记录编号</td>
          <td class="arial-val" style="width:14%;">SOR-SC-088</td>
          <td style="width:8%;">版号</td>
          <td class="arial-val" style="width:8%;">00</td>
          <td style="width:12%;">生效日期</td>
          <td class="arial-val" style="width:14%;">2026.06.22</td>
          <td style="width:8%;">页码</td>
          <td class="arial-val" style="width:7%;">1/1</td>
        </tr>
      </table>

      <div class="print-page-title">
        <h1>开炼工序生产记录（2#）</h1>
      </div>

      <table class="print-table">
        <tr>
          <td colspan="3">产品名称</td>
          <td colspan="12">${row.mingcheng || ''}</td>
          <td colspan="3">生产批号</td>
          <td colspan="4">${row.pici || ''}</td>
          <td colspan="2">型&nbsp;&nbsp;号</td>
          <td colspan="7">${row.xinghao || ''}</td>
        </tr>
        <tr>
          <td colspan="3">规&nbsp;&nbsp;格</td>
          <td colspan="3">${row.guige || ''}</td>
          <td colspan="3">配 方 号</td>
          <td colspan="3">${row.peifang || ''}</td>
          <td colspan="3">生产日期</td>
          <td colspan="13" class="left">
            <span class="print-letter-6">年 月 日 时 分</span>
            <span style="padding:0 8px; font-weight:bold;">～</span>
            <span class="print-letter-6">年 月 日 时 分</span>
          </td>
          <td colspan="2">班&nbsp;&nbsp;次</td>
          <td colspan="1" style="width:12%;"></td>
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td colspan="31" class="section-header-top">生产参数确认</td>
        </tr>
        <tr>
          <td colspan="8">设备编号</td>
          <td colspan="8">压缩空气（kg/cm<sup>2</sup>）</td>
          <td colspan="8">循环水压（Mpa）</td>
          <td colspan="7">冷却水温（℃）</td>
        </tr>
        <tr>
          <td colspan="8" class="arial-val">XS-KLJ-02</td>
          <td colspan="8"></td>
          <td colspan="8"></td>
          <td colspan="7"></td>
        </tr>
        <tr>
          <td colspan="11">辊距（mm）</td>
          <td colspan="12">主机速度（m/min）</td>
          <td colspan="8">翻料速度（m/min）</td>
        </tr>
        <tr>
          <td colspan="11"  style="height: 28px;"></td>
          <td colspan="12"></td>
          <td colspan="8"></td>
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td colspan="31" class="section-header-top">生产操作确认</td>
        </tr>
        <tr>
          <td colspan="5" style="width:12%;">车数</td>
          ${__emptyCells(26)}
        </tr>
        <tr>
          <td colspan="5">完成相应的操作步骤后在车数对应的空格打“√”</td>
          ${__emptyCells(26)}
        </tr>
        <tr>
          <td colspan="5">出料温度测量时间 每0.5h测一次</td>
          ${__col2Cells(13)}
        </tr>
        <tr>
          <td colspan="5">实测出料温度（℃）</td>
          ${__col2Cells(13)}
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td colspan="31"  style="padding-left:10px; text-align: left;">操作人：</td>
        </tr>
        <tr>
          <td colspan="31"  style="padding-left:10px; text-align: left;">备注：</td>
        </tr>
      </table>
    </div>
  `;
}

/* 模板V========== SOR-SC-089 试样硫化生产记录 A4 portrait ========== */
function renderTestSampleVulcanizing(row, idx) {
  return `
    <div class="page-sheet" data-tpl="testsamplevulcanizing">
      <table class="print-meta-table">
        <tr>
          <td class="logo-cell" style="width:11%;"><img src="images/logo.png" alt="Aptar Pharma Logo" style="width:80%"></td>
          <td style="width:11%;">记录编号</td>
          <td class="arial-val" style="width:14%;">SOR-SC-089</td>
          <td style="width:8%;">版号</td>
          <td class="arial-val" style="width:8%;">00</td>
          <td style="width:12%;">生效日期</td>
          <td class="arial-val" style="width:14%;">2026.06.22</td>
          <td style="width:8%;">页码</td>
          <td class="arial-val" style="width:7%;">1/1</td>
        </tr>
      </table>

      <div class="print-page-title" style="margin-bottom:8px;">
        <h1 style="margin:0; line-height:1;">试样硫化生产记录</h1>
      </div>

      <table class="print-table">
        <tr>
          <td colspan="3">产品名称</td>
          <td colspan="13">${row.mingcheng || ''}</td>
          <td colspan="3">生产批号</td>
          <td colspan="5">${row.pici || ''}</td>
        </tr>
        <tr>
          <td colspan="3">型号</td>
          <td colspan="4">${row.xinghao || ''}</td>
          <td colspan="3">规&nbsp;&nbsp;格</td>
          <td colspan="3">${row.guige || ''}</td>
          <td colspan="3">配 方 号</td>
          <td colspan="3">${row.peifang || ''}</td>
          <td colspan="3">硫化序号</td>
          
        </tr>
        <tr>
          <td colspan="3">生产日期</td>
          <td colspan="16" class="left">
            <span class="print-letter-6">年 月 日 时 分</span>
            <span style="padding:0 8px; font-weight:bold;">～</span>
            <span class="print-letter-6">年 月 日 时 分</span>
          </td>
          <td colspan="3">班&nbsp;&nbsp;次</td>
          
        </tr>
        <tr>
          <td colspan="3">设备编号</td>
          <td colspan="9" class="arial-val">XS-LHJ-03</td>
          <td colspan="3">机&nbsp;&nbsp;台</td>
          <td colspan="9">3A</td>
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td colspan="24" class="section-header-top">生产参数确认</td>
        </tr>
        <tr>
          <td colspan="2">参数</td>
          <td colspan="5">加硫/排气压力（kg/cm²）</td>
          <td colspan="6">硫化上模温度（℃）</td>
          <td colspan="6">硫化下模温度（℃）</td>
          <td colspan="5">硫化总时间（s）</td>
        </tr>
        <tr>
          <td colspan="2">设置值</td>
          <td colspan="5"></td>
          <td colspan="6"></td>
          <td colspan="6"></td>
          <td colspan="5"></td>
        </tr>
        <tr>
          <td colspan="2">实际值</td>
          <td colspan="5"></td>
          <td colspan="6"></td>
          <td colspan="6"></td>
          <td colspan="5"></td>
        </tr>
        <tr>
          <td colspan="2" rowspan="3">用胶量</td>
          <td colspan="3">电子秤编号</td>
          <td colspan="8"></td>
          <td colspan="4">操作人</td>
          <td colspan="7"></td>
        </tr>
        <tr>
          <td colspan="3">硫化试块</td>
          <td colspan="8">_____±_____g/块</td>
          <td colspan="4">IPQC复核人</td>
          <td colspan="7"></td>
        </tr>
        <tr>
          <td colspan="3">硫化试片</td>
          <td colspan="8">_____±_____g/片</td>
          <td colspan="11">/</td>
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td colspan="24" class="section-header-top">生产结束后统计（重量保留2位小数）</td>
        </tr>
        <tr>
          <td colspan="4">电子称编号</td>
          <td colspan="20"></td>
        </tr>
        <tr>
          <td colspan="4">数量</td>
          <td colspan="5">硫化试块</td>
          <td colspan="5">硫化试片</td>
          <td colspan="5" >废边量(kg)</td>
          <td colspan="5" style="width:15%;"></td>
        </tr>
        <tr>
          <td colspan="4">硫化总数量</td>
          <td colspan="5"></td>
          <td colspan="5"></td>
          <td colspan="5">不合格品（kg）</td>
          <td colspan="5"></td>
        </tr>
        <tr>
          <td colspan="4">取样数量</td>
          <td colspan="5"></td>
          <td colspan="5"></td>
          <td colspan="5">取样（kg）</td>
          <td colspan="5"></td>
        </tr>
        <tr>
          <td colspan="4">不合格数量</td>
          <td colspan="5"></td>
          <td colspan="5"></td>
          <td colspan="5">未硫化胶片重量（kg）</td>
          <td colspan="5"></td>
        </tr>
      </table>

      <table class="print-subtable" style="margin-top:-1px;">
        <tr>
          <td colspan="24"  style="padding-left:10px; text-align: left;">
            不合格品进行集中废弃处理：□是&nbsp;&nbsp;□否&nbsp;&nbsp;&nbsp;&nbsp;生产复核人：
          </td>
        </tr>
        <tr>
          <td colspan="24"  style="padding-left:10px;  text-align: left;">
            注：硫化序号为窗口号加班次顺序号，如3A1,3A2,3A3…
          </td>
        </tr>
        <tr>
          <td colspan="4" style="width:12%;">备注</td>
          <td colspan="20"></td>
        </tr>
      </table>
    </div>
  `;
}

/* ========== SOR-HR-010 用户培训记录个人汇总 ========== */
function renderUserTrainingSummary(context, idx) {
  const { user = {}, records = [], page = 1, totalPages = 1 } = context || {};

  function h(text) {
    if (text == null) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtDate(d) {
    if (!d) return '';
    const date = new Date(d);
    if (isNaN(date.getTime())) return h(d);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  // 固定 21 行/页，不足补空白行
  const ROWS_PER_PAGE = 21;
  const displayRows = [];
  for (let i = 0; i < ROWS_PER_PAGE; i++) {
    displayRows.push(records[i] || null);
  }

  const displayName = h(user.chinese_name || user.username || '');
  const department = h(user.department || '');
  const position = h(user.position || '');
  const hireDate = user.hire_date ? fmtDate(user.hire_date) : '';

  const dataRowsHTML = displayRows.map((r) => {
    if (!r) {
      return `
        <tr style="height: 40px;">
          <td colspan="4" style="height: 40px;"></td>
          <td colspan="6" style="height: 40px;"></td>
          <td colspan="3" style="height: 40px;"></td>
          <td colspan="3" style="height: 40px;"></td>
          <td colspan="3" style="height: 40px;"></td>
          <td colspan="3" style="height: 40px;"></td>
          <td colspan="3" style="height: 40px;"></td>
        </tr>`;
    }
    const hours = r.training_hours != null ? parseFloat(r.training_hours) : '';
    return `
        <tr style="height: 40px;">
          <td colspan="4" style="height: 40px;">${fmtDate(r.training_date)}</td>
          <td colspan="6" style="height: 40px; text-align: left; padding-left: 6px;">${h(r.training_content)}</td>
          <td colspan="3" style="height: 40px;">${hours}</td>
          <td colspan="3" style="height: 40px;">${h(r.training_form)}</td>
          <td colspan="3" style="height: 40px;">${h(r.assessment_method)}</td>
          <td colspan="3" style="height: 40px;">${h(r.assessment_result)}</td>
          <td colspan="3" style="height: 40px;">${h(r.trainer)}</td>
        </tr>`;
  }).join('');

  return `
    <div class="page-sheet" data-tpl="usertrainingsummary">
      <table class="print-meta-table">
        <tr>
          <td class="logo-cell" style="width:12%; height: 52px; vertical-align: middle;"><img src="images/logo.png" alt="Aptar Pharma Logo" style="width:80%;"></td>
          <td style="width:12%;">记录编号</td>
          <td class="arial-val" style="width:16%;">SOR-HR-010</td>
          <td style="width:8%;">版号</td>
          <td class="arial-val" style="width:8%;">03</td>
          <td style="width:12%;">生效日期</td>
          <td class="arial-val" style="width:16%;">2022.10.26</td>
          <td style="width:8%;">页码</td>
          <td class="arial-val" style="width:8%;">${page}/${totalPages}</td>
        </tr>
      </table>

      <div class="print-page-title" style="margin-bottom: 8px;">
        <h1 style="font-size: 18px; letter-spacing: 1px;">个人培训记录 Personal Training Records</h1>
      </div>

      <table class="print-table">
        <tr>
          <td style="width:44%; text-align: left; padding-left: 10px;">姓名 / Name：${displayName}</td>
          <td style="width:56%; text-align: left; padding-left: 10px;">部门 / Department：${department}</td>
        </tr>
        <tr>
          <td style="width:44%; text-align: left; padding-left: 10px;">岗位 / Position：${position}</td>
          <td style="width:56%; text-align: left; padding-left: 10px;">录用日期 / Hired date：${hireDate}</td>
        </tr>
      </table>

      <table class="print-subtable" style="margin-top: -1px;">
        <tr style="height: 50px;">
          <td colspan="4" style="width:16%; font-weight: bold;">培训日期<br>Date</td>
          <td colspan="6" style="width:24%; font-weight: bold;">培训内容<br>Content</td>
          <td colspan="3" style="width:12%; font-weight: bold;">培训课时<br>Hours</td>
          <td colspan="3" style="width:12%; font-weight: bold;">培训形式<br>Form</td>
          <td colspan="3" style="width:12%; font-weight: bold;">考核方法<br>Inspection Way</td>
          <td colspan="3" style="width:12%; font-weight: bold;">考核结果<br>Result</td>
          <td colspan="3" style="width:12%; font-weight: bold;">培训师<br>Trainer</td>
        </tr>
        ${dataRowsHTML}
      </table>
    </div>
  `;
}
