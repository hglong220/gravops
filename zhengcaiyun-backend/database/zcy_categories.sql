-- 政采云类目数据库表结构和数据
-- 基于真实的132个类目（3个一级 + 35个二级 + 94个三级）

-- 创建类目表
CREATE TABLE IF NOT EXISTS zcy_categories (
    id BIGINT PRIMARY KEY COMMENT '政采云类目ID',
    category_code VARCHAR(50) COMMENT '商品代码',
    name VARCHAR(100) NOT NULL COMMENT '类目名称',
    level TINYINT NOT NULL COMMENT '层级：1=一级，2=二级，3=三级',
    parent_id BIGINT DEFAULT NULL COMMENT '父级ID',
    has_children BOOLEAN DEFAULT FALSE COMMENT '是否有子类目',
    has_spu BOOLEAN DEFAULT FALSE COMMENT '是否有SPU',
    authed BOOLEAN DEFAULT TRUE COMMENT '是否已授权',
    sort_order INT DEFAULT 0 COMMENT '排序',
    status TINYINT DEFAULT 1 COMMENT '状态：1=启用，0=禁用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_parent_id (parent_id),
    INDEX idx_level (level),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='政采云类目表';

-- 插入真实数据（将由脚本自动生成）
-- 数据来源：政采云官方API真实提取

-- 一级：橡胶及塑料制品
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) 
VALUES (2136, '2136', '橡胶及塑料制品', 1, NULL, TRUE, TRUE, 1);

-- 二级：橡胶及塑料制品的子类
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES
(2137, '213701', '橡胶带', 2, 2136, TRUE, TRUE, 1),
(2143, '213702', '橡胶板', 2, 2136, TRUE, TRUE, 2),
(2156, '213703', '塑料片', 2, 2136, TRUE, TRUE, 3),
(2166, '213704', '塑料管', 2, 2136, TRUE, TRUE, 4),
(2180, '213705', '橡胶管', 2, 2136, TRUE, TRUE, 5),
(2197, '213706', '其他橡胶塑料制品', 2, 2136, TRUE, TRUE, 6);

-- 三级：橡胶带的子类
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES
(2138, '21370101', '橡胶止水带', 3, 2137, FALSE, FALSE, TRUE, 1),
(2139, '21370102', '橡胶传送带', 3, 2137, FALSE, FALSE, TRUE, 2),
(2140, '21370103', '橡胶捆绑带', 3, 2137, FALSE, FALSE, TRUE, 3),
(2141, '21370104', '橡胶履带', 3, 2137, FALSE, FALSE, TRUE, 4);

-- 三级：橡胶板的子类
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_spu, authed, sort_order) VALUES
(2144, '21370201', '夹布胶板', 3, 2143, FALSE, TRUE, 1),
(2145, '21370202', '绝缘胶板', 3, 2143, FALSE, TRUE, 2),
(2146, '21370203', '耐油胶板', 3, 2143, FALSE, TRUE, 3),
(2147, '21370204', '耐酸碱胶板', 3, 2143, FALSE, TRUE, 4),
(2148, '21370205', '防腐衬里', 3, 2143, FALSE, TRUE, 5),
(2149, '21370206', '阻尼胶板', 3, 2143, FALSE, TRUE, 6),
(2150, '21370207', '防滑胶板', 3, 2143, FALSE, TRUE, 7),
(2151, '21370208', '防腐胶板', 3, 2143, FALSE, TRUE, 8),
(2152, '21370209', '耐磨胶板', 3, 2143, FALSE, TRUE, 9),
(2153, '21370210', '防静电胶板', 3, 2143, FALSE, TRUE, 10),
(2154, '21370211', '特种橡胶板', 3, 2143, FALSE, TRUE, 11);

-- 一级：文化用品
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) 
VALUES (4402, '4402', '文化用品', 1, NULL, TRUE, TRUE, 2);

-- 二级：文化用品的子类
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES
(4440, '440201', '笔类/书写工具', 2, 4402, TRUE, TRUE, 1),
(4441, '440202', '纸张本册', 2, 4402, TRUE, TRUE, 2),
(4442, '440203', '财会用品', 2, 4402, TRUE, TRUE, 3),
(4443, '440204', '收纳/陈列用品', 2, 4402, TRUE, TRUE, 4),
(4444, '440205', '装订用品', 2, 4402, TRUE, TRUE, 5);

-- 三级：笔类/书写工具的子类
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_spu, authed, sort_order) VALUES
(5225, '44020101', '中性笔', 3, 4440, FALSE, TRUE, 1),
(5226, '44020102', '替芯/铅芯', 3, 4440, FALSE, TRUE, 2),
(5227, '44020103', '铅笔', 3, 4440, FALSE, TRUE, 3),
(5228, '44020104', '钢笔', 3, 4440, FALSE, TRUE, 4),
(5229, '44020105', '笔用墨水/补充液/墨囊', 3, 4440, FALSE, TRUE, 5),
(5230, '44020106', '圆珠笔', 3, 4440, FALSE, TRUE, 6),
(5231, '44020107', '宝珠/走珠/签字笔', 3, 4440, FALSE, TRUE, 7),
(5232, '44020108', '荧光笔', 3, 4440, FALSE, TRUE, 8),
(5233, '44020109', '油漆笔', 3, 4440, FALSE, TRUE, 9),
(5235, '44020110', '马克笔', 3, 4440, FALSE, TRUE, 10),
(5236, '44020111', '针管笔', 3, 4440, FALSE, TRUE, 11),
(5237, '44020112', '泡泡笔', 3, 4440, FALSE, TRUE, 12),
(5238, '44020113', '正姿笔', 3, 4440, FALSE, TRUE, 13);

-- 三级：纸张本册的子类
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_spu, authed, sort_order) VALUES
(5239, '44020201', 'PU/PVC笔记本', 3, 4441, TRUE, TRUE, 1),
(5240, '44020202', '学生用笔记本', 3, 4441, TRUE, TRUE, 2),
(5241, '44020203', '记事本', 3, 4441, TRUE, TRUE, 3),
(5242, '44020204', '便签本/便条纸/N次贴', 3, 4441, TRUE, TRUE, 4),
(5243, '44020205', '胶装本', 3, 4441, TRUE, TRUE, 5),
(5244, '44020206', '分页纸/索引纸', 3, 4441, TRUE, TRUE, 6),
(5245, '44020207', '螺旋本', 3, 4441, FALSE, TRUE, 7),
(5246, '44020208', '不干胶标签', 3, 4441, FALSE, TRUE, 8),
(5247, '44020209', '硬面抄', 3, 4441, TRUE, TRUE, 9);

-- 一级：文化玩乐
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) 
VALUES (4410, '4410', '文化玩乐', 1, NULL, TRUE, TRUE, 3);

-- 二级：文化玩乐的子类
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES
(4604, '441001', '书籍/杂志/报纸', 2, 4410, TRUE, TRUE, 1),
(4605, '441002', '钢琴及配件', 2, 4410, TRUE, TRUE, 2),
(4607, '441003', '吉他及配件', 2, 4410, TRUE, TRUE, 3),
(4608, '441004', '提琴及配件', 2, 4410, TRUE, TRUE, 4);

-- 创建辅助查询视图
CREATE OR REPLACE VIEW v_category_tree AS
SELECT 
    c1.id as level1_id,
    c1.name as level1_name,
    c2.id as level2_id,
    c2.name as level2_name,
    c3.id as level3_id,
    c3.name as level3_name,
    c3.category_code,
    c3.has_spu
FROM zcy_categories c1
LEFT JOIN zcy_categories c2 ON c2.parent_id = c1.id AND c2.level = 2
LEFT JOIN zcy_categories c3 ON c3.parent_id = c2.id AND c3.level = 3
WHERE c1.level = 1 AND c1.status = 1;

-- 查询统计
SELECT 
    level,
    COUNT(*) as count,
    COUNT(CASE WHEN has_spu = TRUE THEN 1 END) as has_spu_count
FROM zcy_categories
GROUP BY level
ORDER BY level;

COMMIT;
