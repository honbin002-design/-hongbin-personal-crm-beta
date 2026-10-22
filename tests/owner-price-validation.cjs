// Synthetic-only supplier cost validation. Never commit actual customer or price records.
const { validateOwnerPriceFile } = await import('../owner-prices.mjs');
const assert = (condition, reason) => { if (!condition) throw Error(reason); };
const fixture = () => ({
  format: 'hongbin-crm-owner-supplier-prices',
  schema: 1,
  source: { fileId: '1UPTW2FbFBflVgAeQV1sVuYlL0yfOWOjr', fileName: 'synthetic-fixture.xlsx' },
  prices: [
    { supplierName: '虛構供應商 A', partNo: 'S-01', productName: '虛構產品 A', unit: 'KG', price: 120.5 },
    { supplierName: '虛構供應商 B', partNo: 'S-02', productName: '虛構產品 B', unit: '桶', price: 89 }
  ]
});
let passed = 0;
function shouldPass(name, change, verify) {
  const f = fixture();
  change?.(f);
  const rows = validateOwnerPriceFile(f);
  assert(verify(rows), name);
  passed++;
}
function shouldReject(name, change) {
  const f = fixture();
  change(f);
  let rejected = false;
  try { validateOwnerPriceFile(f); } catch { rejected = true; }
  assert(rejected, '應拒絕：' + name);
  passed++;
}
shouldPass('正常供應商進價結構', null, rows =>
  rows.length === 2 && rows[0].price === 120.5 && rows[1].unit === '桶');
shouldPass('不可挾帶未受控欄位', f => { f.prices[0].secret = 'synthetic'; },
  rows => !Object.hasOwn(rows[0], 'secret'));
shouldPass('輸入空白正規化', f => { f.prices[0].partNo = '  S-01  '; },
  rows => rows[0].partNo === 'S-01');
shouldReject('非指定格式', f => { f.format = 'wrong'; });
shouldReject('非指定版號', f => { f.schema = 2; });
shouldReject('非指定原始價格表', f => { f.source.fileId = 'wrong'; });
shouldReject('空價格陣列', f => { f.prices = []; });
shouldReject('超出上限', f => { f.prices = Array.from({length:401},(_,i)=>({
 supplierName: '虛構供應商', partNo: 'S-'+i, price: 100
})); });
shouldReject('空供應商', f => { f.prices[0].supplierName = ' '; });
shouldReject('空品號', f => { f.prices[0].partNo = ' '; });
shouldReject('品號超長', f => { f.prices[0].partNo = 'A'.repeat(121); });
shouldReject('品名超長', f => { f.prices[0].productName = 'A'.repeat(201); });
shouldReject('單位超長', f => { f.prices[0].unit = 'A'.repeat(31); });
shouldReject('相同供應商加相同品號', f => { f.prices.push({...f.prices[0]}); });
shouldReject('重複供應商品號忽略大小寫及空白', f => {
 f.prices[1] = {...f.prices[0],supplierName:'  虛構供應商 A ',partNo:'s-01'};
});
shouldReject('零進價', f => { f.prices[0].price = 0; });
shouldReject('負進價', f => { f.prices[0].price = -100; });
shouldReject('非數字進價', f => { f.prices[0].price = '120'; });
shouldReject('NaN 進價', f => { f.prices[0].price = NaN; });
shouldReject('無限大進價', f => { f.prices[0].price = Infinity; });
shouldReject('過大進價', f => { f.prices[0].price = 1e9; });
shouldReject('非物件列', f => { f.prices[0] = null; });
console.log('OWNER_PRICE_VALIDATION_PASS', passed);
