/* eslint-disable no-console */
/**
 * 测试环境数据清理脚本。
 * 说明：当前后端为内存存储，重启进程即可清空；此脚本用于提供标准化重置提示。
 */

function main(): void {
  console.log('reset done: 当前为内存存储，重启 API 进程即可清空测试数据。');
  console.log('若切换到 PostgreSQL，请在此脚本中实现 TRUNCATE + RESEED。');
}

main();
