-- 政采云类目完整数据导入
-- 数据来源：政采云官方API真实提取
-- 总计：132个类目（3个一级 + 35个二级 + 94个三级）
-- 生成时间：2025-11-28T20:44:25.037Z

-- 清空旧数据
DELETE FROM zcy_categories;

-- 插入一级类目 (3个)
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (2136, '2136', '橡胶及塑料制品', 1, NULL, 1, 1, 1);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (4402, '4402', '文化用品', 1, NULL, 1, 1, 2);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (4410, '4410', '文化玩乐', 1, NULL, 1, 1, 3);

-- 插入二级类目 (35个)
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (2137, '2137', '橡胶带', 2, 2136, 1, 1, 1);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (2143, '2143', '橡胶板', 2, 2136, 1, 1, 2);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (2156, '2156', '塑料片', 2, 2136, 1, 1, 3);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (2166, '2166', '塑料管', 2, 2136, 1, 1, 4);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (2180, '2180', '橡胶管', 2, 2136, 1, 1, 5);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (2197, '2197', '其他橡胶塑料制品', 2, 2136, 1, 1, 6);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (4440, '4440', '笔类/书写工具', 2, 4402, 1, 1, 7);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (4441, '4441', '纸张本册', 2, 4402, 1, 1, 8);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (4442, '4442', '财会用品', 2, 4402, 1, 1, 9);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (4443, '4443', '收纳/陈列用品', 2, 4402, 1, 1, 10);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (4444, '4444', '装订用品', 2, 4402, 1, 1, 11);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (4445, '4445', '刀剪/粘胶/测绘', 2, 4402, 1, 1, 12);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (4446, '4446', '日常学习用品', 2, 4402, 1, 1, 13);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (4447, '4447', '画具/画材/书法用品', 2, 4402, 1, 1, 14);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (4448, '4448', '其它办公用品', 2, 4402, 1, 1, 15);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (4449, '4449', '印刷制品', 2, 4402, 1, 1, 16);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (4450, '4450', '教学用具', 2, 4402, 1, 1, 17);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (4451, '4451', '实验室用品', 2, 4402, 1, 1, 18);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (4452, '4452', '电子产品及配件', 2, 4402, 1, 1, 19);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (4453, '4453', '期刊/资料/档案', 2, 4402, 1, 1, 20);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (4454, '4454', '图书/档案设备', 2, 4402, 1, 1, 21);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (4604, '4604', '书籍/杂志/报纸', 2, 4410, 1, 1, 22);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (4605, '4605', '钢琴及配件', 2, 4410, 1, 1, 23);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (4607, '4607', '吉他及配件', 2, 4410, 1, 1, 24);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (4608, '4608', '提琴及配件', 2, 4410, 1, 1, 25);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (4609, '4609', '西洋乐器', 2, 4410, 1, 1, 26);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (4610, '4610', '民族乐器', 2, 4410, 1, 1, 27);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (4611, '4611', '乐器配件', 2, 4410, 1, 1, 28);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (4612, '4612', '锣', 2, 4410, 1, 1, 29);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (4613, '4613', '鼓', 2, 4410, 1, 1, 30);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (4614, '4614', '儿童玩具乐器', 2, 4410, 1, 1, 31);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (4615, '4615', '乐器音箱', 2, 4410, 1, 1, 32);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (4616, '4616', '模玩/动漫/周边/cos/桌游', 2, 4410, 1, 1, 33);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (4617, '4617', 'MIDI乐器/电脑音乐', 2, 4410, 1, 1, 34);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (4618, '4618', '古董/邮币/字画/收藏', 2, 4410, 1, 1, 35);

-- 插入三级类目 (94个)
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2138, '2138', '橡胶止水带', 3, 2137, 0, 0, 1, 1);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2139, '2139', '橡胶传送带', 3, 2137, 0, 0, 1, 2);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2140, '2140', '橡胶捆绑带', 3, 2137, 0, 0, 1, 3);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2141, '2141', '橡胶履带', 3, 2137, 0, 0, 1, 4);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2144, '2144', '夹布胶板', 3, 2143, 0, 0, 1, 5);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2145, '2145', '绝缘胶板', 3, 2143, 0, 0, 1, 6);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2146, '2146', '耐油胶板', 3, 2143, 0, 0, 1, 7);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2147, '2147', '耐酸碱胶板', 3, 2143, 0, 0, 1, 8);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2148, '2148', '防腐衬里', 3, 2143, 0, 0, 1, 9);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2149, '2149', '阻尼胶板', 3, 2143, 0, 0, 1, 10);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2150, '2150', '防滑胶板', 3, 2143, 0, 0, 1, 11);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2151, '2151', '防腐胶板', 3, 2143, 0, 0, 1, 12);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2152, '2152', '耐磨胶板', 3, 2143, 0, 0, 1, 13);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2153, '2153', '防静电胶板', 3, 2143, 0, 0, 1, 14);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2154, '2154', '特种橡胶板', 3, 2143, 0, 0, 1, 15);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2157, '2157', 'PP塑料片', 3, 2156, 0, 0, 1, 16);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2158, '2158', 'PE塑料片', 3, 2156, 0, 0, 1, 17);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2159, '2159', 'PET塑料片', 3, 2156, 0, 0, 1, 18);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2160, '2160', 'ABS塑料片', 3, 2156, 0, 0, 1, 19);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2161, '2161', 'PMMA塑料片', 3, 2156, 0, 0, 1, 20);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2162, '2162', 'PC塑料片', 3, 2156, 0, 0, 1, 21);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2163, '2163', 'PS塑料片', 3, 2156, 0, 0, 1, 22);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2165, '2165', 'PVC塑料片', 3, 2156, 0, 0, 1, 23);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2167, '2167', 'PVC管', 3, 2166, 0, 0, 1, 24);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2168, '2168', 'PPR管', 3, 2166, 0, 0, 1, 25);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2169, '2169', 'PP管', 3, 2166, 0, 0, 1, 26);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2170, '2170', 'PE管', 3, 2166, 0, 0, 1, 27);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2171, '2171', 'PC管', 3, 2166, 0, 0, 1, 28);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2172, '2172', 'ABS管', 3, 2166, 0, 0, 1, 29);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2173, '2173', 'PMMA管', 3, 2166, 0, 0, 1, 30);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2174, '2174', '铝塑管', 3, 2166, 0, 0, 1, 31);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2175, '2175', '波纹管', 3, 2166, 0, 0, 1, 32);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2176, '2176', 'PA管', 3, 2166, 0, 0, 1, 33);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2177, '2177', 'PU管', 3, 2166, 0, 0, 1, 34);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2179, '2179', '钢塑管', 3, 2166, 0, 0, 1, 35);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2181, '2181', '低压橡胶管', 3, 2180, 0, 0, 1, 36);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2182, '2182', '高压橡胶管', 3, 2180, 0, 0, 1, 37);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2183, '2183', '硅胶管', 3, 2180, 0, 0, 1, 38);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2184, '2184', '伸缩胶管', 3, 2180, 0, 0, 1, 39);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2185, '2185', '编织胶管', 3, 2180, 0, 0, 1, 40);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2186, '2186', '缠绕胶管', 3, 2180, 0, 0, 1, 41);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2187, '2187', '夹布胶管', 3, 2180, 0, 0, 1, 42);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2188, '2188', '增强软管', 3, 2180, 0, 0, 1, 43);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2189, '2189', '复合胶管', 3, 2180, 0, 0, 1, 44);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2190, '2190', '液压胶管', 3, 2180, 0, 0, 1, 45);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2191, '2191', '喷砂胶管', 3, 2180, 0, 0, 1, 46);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2192, '2192', '耐油胶管', 3, 2180, 0, 0, 1, 47);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2193, '2193', '纤维胶管', 3, 2180, 0, 0, 1, 48);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2194, '2194', '特种胶管', 3, 2180, 0, 0, 1, 49);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2195, '2195', '胶管接头', 3, 2180, 0, 0, 1, 50);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2198, '2198', '涂胶纺织物', 3, 2197, 0, 0, 1, 51);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2199, '2199', '日用及医疗橡胶制品', 3, 2197, 0, 0, 1, 52);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2200, '2200', '泡沫塑料', 3, 2197, 0, 0, 1, 53);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2201, '2201', '塑料网', 3, 2197, 0, 0, 1, 54);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2202, '2202', '塑料绳', 3, 2197, 0, 0, 1, 55);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2203, '2203', '塑料建材', 3, 2197, 0, 0, 1, 56);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2204, '2204', '橡胶棒', 3, 2197, 0, 0, 1, 57);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (2205, '2205', '橡胶片', 3, 2197, 0, 0, 1, 58);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (5225, '5225', '中性笔', 3, 4440, 0, 0, 1, 59);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (5226, '5226', '替芯/铅芯', 3, 4440, 0, 0, 1, 60);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (5227, '5227', '铅笔', 3, 4440, 0, 0, 1, 61);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (5228, '5228', '钢笔', 3, 4440, 0, 0, 1, 62);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (5229, '5229', '笔用墨水/补充液/墨囊', 3, 4440, 0, 0, 1, 63);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (5230, '5230', '圆珠笔', 3, 4440, 0, 0, 1, 64);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (5231, '5231', '宝珠/走珠/签字笔', 3, 4440, 0, 0, 1, 65);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (5232, '5232', '荧光笔', 3, 4440, 0, 0, 1, 66);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (5233, '5233', '油漆笔', 3, 4440, 0, 0, 1, 67);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (5235, '5235', '马克笔', 3, 4440, 0, 0, 1, 68);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (5236, '5236', '针管笔', 3, 4440, 0, 0, 1, 69);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (5237, '5237', '泡泡笔', 3, 4440, 0, 0, 1, 70);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (5238, '5238', '正姿笔', 3, 4440, 0, 0, 1, 71);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (5239, '5239', 'PU/PVC笔记本', 3, 4441, 0, 1, 1, 72);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (5240, '5240', '学生用笔记本', 3, 4441, 0, 1, 1, 73);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (5241, '5241', '记事本', 3, 4441, 0, 1, 1, 74);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (5242, '5242', '便签本/便条纸/N次贴', 3, 4441, 0, 1, 1, 75);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (5243, '5243', '胶装本', 3, 4441, 0, 1, 1, 76);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (5244, '5244', '分页纸/索引纸', 3, 4441, 0, 1, 1, 77);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (5245, '5245', '螺旋本', 3, 4441, 0, 0, 1, 78);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (5246, '5246', '不干胶标签', 3, 4441, 0, 0, 1, 79);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (5247, '5247', '硬面抄', 3, 4441, 0, 1, 1, 80);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (5248, '5248', '奖状/证书', 3, 4441, 0, 1, 1, 81);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (5249, '5249', '同学录/纪念册', 3, 4441, 0, 0, 1, 82);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (5250, '5250', '拍纸本', 3, 4441, 0, 1, 1, 83);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (5251, '5251', '信纸', 3, 4441, 0, 1, 1, 84);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (5252, '5252', '万用手册', 3, 4441, 0, 0, 1, 85);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (5253, '5253', '课业本/教学用本', 3, 4441, 0, 0, 1, 86);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (5254, '5254', '日记本', 3, 4441, 0, 1, 1, 87);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (5255, '5255', '活页替芯', 3, 4441, 0, 0, 1, 88);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (5256, '5256', '磁性贴', 3, 4441, 0, 0, 1, 89);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (5257, '5257', '贴纸', 3, 4441, 0, 0, 1, 90);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (5258, '5258', '折纸/手工纸', 3, 4441, 0, 0, 1, 91);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (5259, '5259', '通讯录/电话本', 3, 4441, 0, 0, 1, 92);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (5260, '5260', '书签', 3, 4441, 0, 0, 1, 93);
INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (5261, '5261', 'POP广告纸/爆炸贴', 3, 4441, 0, 0, 1, 94);

-- 提交事务
COMMIT;
