-- V7__admin_workflows_and_baan_seed.sql
-- Add READY order status support and refresh deterministic demo catalog data
-- with a larger BAAN-menu-inspired branch preset for local development.

BEGIN;

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('PENDING', 'PREPARE', 'READY', 'DELIVERY', 'COMPLETED', 'REJECTED'));

INSERT INTO categories (id, company_id, slug, name, description, sort_order, is_active)
VALUES
  (1, 1, 'kaprao-signatures', 'Kaprao Signatures', 'House basil rice, crispy pork basil, and the BAAN-style spicy stir-fried rice line.', 1, TRUE),
  (2, 1, 'fried-rice-wok', 'Fried Rice & Wok Rice', 'Fried rice, chili-salt rice, and other fast wok-fired rice plates.', 2, TRUE),
  (3, 1, 'curry-and-spicy-wok', 'Curry & Spicy Wok', 'Red curry, dry green curry, and kua kling style rice dishes.', 3, TRUE),
  (4, 1, 'vegetable-and-light', 'Vegetable & Light', 'Vegetable-forward rice plates and lighter wok options.', 4, TRUE),
  (5, 1, 'grill-and-fried-favorites', 'Grill & Fried Favorites', 'Grilled pork neck and heavier comfort dishes for dinner service.', 5, TRUE)
ON CONFLICT (id) DO UPDATE
SET slug = EXCLUDED.slug,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active;

SELECT setval(pg_get_serial_sequence('categories', 'id'), GREATEST((SELECT MAX(id) FROM categories), 1), TRUE);

INSERT INTO products (id, company_id, slug, name, description, image_url, base_price, search_terms, is_active)
VALUES
  (1, 1, 'baan-kaprao', 'Baan Kaprao', 'House-style hot-and-dry basil rice inspired by the BAAN signature menu.', 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80', 89.00, 'baan kaprao, kaprao, basil rice, ข้าวกะเพราบ้านบ้าน, กะเพรา', TRUE),
  (2, 1, 'emperor-kaprao', 'Emperor Kaprao', 'Sweet-hot basil rice with the richer BAAN emperor-style seasoning.', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80', 92.00, 'emperor kaprao, basil rice, ข้าวกะเพราจักรพรรดิ, กะเพรา', TRUE),
  (3, 1, 'general-kaprao', 'General''s Kaprao', 'Extra-spicy basil rice with red curry heat, based on the BAAN general-style dish.', 'https://images.unsplash.com/photo-1555126634-323283e090fa?auto=format&fit=crop&w=900&q=80', 95.00, 'general kaprao, spicy basil rice, ข้าวกะเพราแม่ทัพใหญ่, กะเพราเผ็ด', TRUE),
  (4, 1, 'crispy-pork-kaprao', 'Crispy Pork Kaprao', 'Crispy pork belly tossed in hot basil sauce and served over jasmine rice.', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80', 94.00, 'crispy pork kaprao, pork belly basil rice, ข้าวกะเพราหมูสามชั้น, หมูกรอบ', TRUE),
  (5, 1, 'three-buddies-curry-rice', 'Three Buddies Curry Rice', 'Red curry fried rice with shrimp, boiled egg, and crispy pork in the BAAN style.', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80', 90.00, 'three buddies curry rice, red curry fried rice, ข้าวคั่วพริกแกงสามสหาย', TRUE),
  (6, 1, 'green-curry-fried-rice', 'Green Curry Fried Rice', 'Green curry fried rice with chicken, boiled egg, and fried pork, adapted from the BAAN menu.', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80', 90.00, 'green curry fried rice, ข้าวคั่วเขียวหวานหลายใจ, ข้าวผัดแกงเขียวหวาน', TRUE),
  (7, 1, 'baan-fried-rice', 'Baan Fried Rice', 'Dry chili fried rice with fried pork and sliced garlic.', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80', 88.00, 'baan fried rice, dry chili fried rice, ข้าวผัดบ้านบ้าน', TRUE),
  (8, 1, 'chili-salt-fried-rice', 'Chili Salt Fried Rice', 'Chili-and-salt fried rice with pork or seafood in the BAAN house style.', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80', 92.00, 'chili salt fried rice, ข้าวคั่วพริกเกลือ, ข้าวผัด', TRUE),
  (9, 1, 'dry-green-curry-rice', 'Dry Green Curry Rice', 'Dry stir-fried green curry rice plate with a bolder, richer wok finish.', 'https://images.unsplash.com/photo-1555126634-323283e090fa?auto=format&fit=crop&w=900&q=80', 90.00, 'dry green curry rice, ข้าวเขียวหวานแห้ง, แกงเขียวหวาน', TRUE),
  (10, 1, 'mixed-vegetable-rice', 'Mixed Vegetable Rice', 'Mixed vegetables stir-fried and served over rice for a lighter menu option.', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80', 79.00, 'mixed vegetable rice, ข้าวราดผัดผักรวม, ผักรวม', TRUE),
  (11, 1, 'morning-glory-crispy-pork-rice', 'Morning Glory with Crispy Pork', 'Morning glory stir-fried with crispy pork belly over rice.', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80', 84.00, 'morning glory crispy pork, ข้าวผักบุ้งหมูกรอบ, ผักบุ้ง', TRUE),
  (12, 1, 'kale-oyster-sauce-rice', 'Kale with Oyster Sauce', 'Chinese kale stir-fried with oyster sauce and served over rice.', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80', 80.00, 'kale oyster sauce rice, ข้าวคะน้าน้ำมันหอย, คะน้า', TRUE),
  (13, 1, 'spare-ribs-red-curry-rice', 'Spare Ribs Red Curry Rice', 'Tender spare ribs in dry red curry paste over rice.', 'https://images.unsplash.com/photo-1555126634-323283e090fa?auto=format&fit=crop&w=900&q=80', 90.00, 'spare ribs red curry rice, ข้าวกระดูกอ่อนผัดพริกแกง, กระดูกอ่อน', TRUE),
  (14, 1, 'kua-kling-rice', 'Kua Kling Rice', 'Dry southern-style spicy curry stir-fry over rice, inspired by the BAAN kua kling dishes.', 'https://images.unsplash.com/photo-1555126634-323283e090fa?auto=format&fit=crop&w=900&q=80', 89.00, 'kua kling rice, ข้าวคั่วกลิ้ง, คั่วกลิ้ง', TRUE),
  (15, 1, 'grilled-pork-neck-rice', 'Grilled Pork Neck Rice', 'Grilled pork neck over rice for the heavier grill-and-rice dinner lane.', 'https://images.unsplash.com/photo-1562967916-eb82221dfb92?auto=format&fit=crop&w=900&q=80', 95.00, 'grilled pork neck rice, ข้าวคอหมูย่าง, คอหมูย่าง', TRUE)
ON CONFLICT (id) DO UPDATE
SET slug = EXCLUDED.slug,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    image_url = EXCLUDED.image_url,
    base_price = EXCLUDED.base_price,
    search_terms = EXCLUDED.search_terms,
    is_active = EXCLUDED.is_active;

SELECT setval(pg_get_serial_sequence('products', 'id'), GREATEST((SELECT MAX(id) FROM products), 1), TRUE);

DELETE FROM product_categories
WHERE product_id BETWEEN 1 AND 15;

INSERT INTO product_categories (product_id, category_id)
VALUES
  (1, 1),
  (2, 1),
  (3, 1),
  (4, 1),
  (5, 2),
  (6, 2),
  (7, 2),
  (8, 2),
  (9, 3),
  (10, 4),
  (11, 4),
  (12, 4),
  (13, 3),
  (14, 3),
  (15, 5)
ON CONFLICT (product_id, category_id) DO NOTHING;

DELETE FROM product_add_ons
WHERE product_id BETWEEN 1 AND 15;

INSERT INTO product_add_ons (id, product_id, group_name, name, price, is_required, sort_order)
VALUES
  (1, 1, 'extras', 'Fried Egg', 12.00, FALSE, 1),
  (2, 1, 'protein', 'Crispy Pork', 18.00, FALSE, 2),
  (3, 2, 'protein', 'Shrimp', 25.00, FALSE, 1),
  (4, 5, 'extras', 'Boiled Egg', 12.00, FALSE, 1),
  (5, 6, 'extras', 'Boiled Egg', 12.00, FALSE, 1),
  (6, 8, 'protein', 'Seafood', 28.00, FALSE, 1),
  (7, 13, 'extras', 'Fried Egg', 12.00, FALSE, 1),
  (8, 14, 'extras', 'Fried Egg', 12.00, FALSE, 1)
ON CONFLICT (id) DO UPDATE
SET product_id = EXCLUDED.product_id,
    group_name = EXCLUDED.group_name,
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    is_required = EXCLUDED.is_required,
    sort_order = EXCLUDED.sort_order;

SELECT setval(pg_get_serial_sequence('product_add_ons', 'id'), GREATEST((SELECT MAX(id) FROM product_add_ons), 1), TRUE);

DELETE FROM branch_products
WHERE branch_id IN (1, 2, 3)
  AND product_id BETWEEN 1 AND 15;

INSERT INTO branch_products (id, branch_id, product_id, is_enabled, stock_qty, price_override, is_recommended, sort_order, reorder_level)
VALUES
  (1, 1, 1, TRUE, 60, NULL, TRUE, 1, 10),
  (2, 1, 2, TRUE, 48, NULL, TRUE, 2, 10),
  (3, 1, 3, TRUE, 36, NULL, TRUE, 3, 8),
  (4, 1, 4, TRUE, 42, NULL, TRUE, 4, 8),
  (5, 1, 5, TRUE, 28, NULL, TRUE, 5, 8),
  (6, 1, 6, TRUE, 24, NULL, FALSE, 6, 8),
  (7, 1, 7, TRUE, 30, NULL, TRUE, 7, 8),
  (8, 1, 8, TRUE, 26, NULL, FALSE, 8, 8),
  (9, 1, 9, TRUE, 24, 95.00, FALSE, 9, 8),
  (10, 1, 10, TRUE, 18, NULL, FALSE, 10, 6),
  (11, 1, 11, TRUE, 20, NULL, FALSE, 11, 6),
  (12, 1, 12, TRUE, 18, NULL, FALSE, 12, 6),
  (13, 1, 13, TRUE, 22, NULL, TRUE, 13, 6),
  (14, 1, 14, TRUE, 24, NULL, TRUE, 14, 6),
  (15, 1, 15, TRUE, 18, NULL, TRUE, 15, 6),

  (16, 2, 1, TRUE, 34, NULL, TRUE, 1, 8),
  (17, 2, 3, TRUE, 20, NULL, FALSE, 2, 8),
  (18, 2, 4, TRUE, 22, NULL, TRUE, 3, 8),
  (19, 2, 5, TRUE, 18, NULL, TRUE, 4, 8),
  (20, 2, 6, TRUE, 16, NULL, FALSE, 5, 8),
  (21, 2, 8, TRUE, 20, 95.00, TRUE, 6, 8),
  (22, 2, 10, TRUE, 16, NULL, FALSE, 7, 6),
  (23, 2, 11, TRUE, 18, NULL, TRUE, 8, 6),
  (24, 2, 13, TRUE, 14, NULL, TRUE, 9, 6),
  (25, 2, 14, TRUE, 16, NULL, FALSE, 10, 6),
  (26, 2, 15, TRUE, 14, NULL, TRUE, 11, 6),

  (27, 3, 1, TRUE, 40, NULL, TRUE, 1, 8),
  (28, 3, 2, TRUE, 28, NULL, TRUE, 2, 8),
  (29, 3, 5, TRUE, 18, NULL, TRUE, 3, 8),
  (30, 3, 6, TRUE, 20, NULL, TRUE, 4, 8),
  (31, 3, 7, TRUE, 22, NULL, TRUE, 5, 8),
  (32, 3, 8, TRUE, 20, NULL, FALSE, 6, 8),
  (33, 3, 9, TRUE, 18, NULL, TRUE, 7, 8),
  (34, 3, 11, TRUE, 16, NULL, FALSE, 8, 6),
  (35, 3, 12, TRUE, 16, NULL, FALSE, 9, 6),
  (36, 3, 14, TRUE, 18, NULL, TRUE, 10, 6),
  (37, 3, 15, TRUE, 16, NULL, TRUE, 11, 6)
ON CONFLICT (id) DO UPDATE
SET branch_id = EXCLUDED.branch_id,
    product_id = EXCLUDED.product_id,
    is_enabled = EXCLUDED.is_enabled,
    stock_qty = EXCLUDED.stock_qty,
    price_override = EXCLUDED.price_override,
    is_recommended = EXCLUDED.is_recommended,
    sort_order = EXCLUDED.sort_order,
    reorder_level = EXCLUDED.reorder_level;

SELECT setval(pg_get_serial_sequence('branch_products', 'id'), GREATEST((SELECT MAX(id) FROM branch_products), 1), TRUE);

COMMIT;
