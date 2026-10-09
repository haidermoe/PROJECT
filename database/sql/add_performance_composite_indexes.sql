-- ======================================================================
-- Odoo 19 Style High-Performance Indexes for Multi-Branch Architecture
-- تسريع استعلامات الفروع المتعددة ومنع Full Table Scans
-- ======================================================================

-- 1. فهارس القيود المحاسبية (account_move & account_move_line)
ALTER TABLE `account_move` 
  ADD INDEX `idx_move_branch_state_date` (`branch_id`, `state`, `date`);

ALTER TABLE `account_move_line`
  ADD INDEX `idx_line_move_acc_amounts` (`move_id`, `account_id`, `debit`, `credit`);

-- 2. فهارس طلبات وفواتير نقاط البيع (pos_orders)
ALTER TABLE `pos_orders`
  ADD INDEX `idx_orders_branch_status_created` (`branch_id`, `status`, `created_at`);

-- 3. فهارس مخزون المواد والمطابخ (ingredients)
ALTER TABLE `ingredients`
  ADD INDEX `idx_ing_branch_stock` (`branch_id`, `stock_quantity`);

-- 4. فهارس مناقلات الفروع اللوجستية (inter_branch_transfers)
ALTER TABLE `inter_branch_transfers`
  ADD INDEX `idx_ibt_from_to_status` (`from_branch_id`, `to_branch_id`, `status`);
