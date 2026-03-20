package panel

const defaultSeedSQL = `
INSERT INTO users (id, email, full_name, auth_provider, status)
VALUES ('10000000-0000-0000-0000-000000000001', 'demo@panel.local', 'Demo Engineer', 'seed', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO projects (id, key, name, description, owner_user_id, status)
VALUES ('00000000-0000-0000-0000-000000000100', 'CORE-BANKING', 'Core Banking Platform', 'Demo workspace for service topology, schema, mapping, and field lineage exploration', '10000000-0000-0000-0000-000000000001', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_members (project_id, user_id, role)
VALUES ('00000000-0000-0000-0000-000000000100', '10000000-0000-0000-0000-000000000001', 'admin')
ON CONFLICT (project_id, user_id) DO NOTHING;

INSERT INTO flows (id, project_id, code, name, description, business_domain, status, created_by, updated_by)
VALUES
('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000100', 'create_account', 'create_account', 'Flagship onboarding flow with cache, external risk, persistence, events, and notifications', 'core-banking', 'published', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000100', 'balance_inquiry', 'balance_inquiry', 'Balance read path with cache and core database lookup', 'core-banking', 'published', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000100', 'internal_transfer', 'internal_transfer', 'Transfer orchestration with posting and downstream event publication', 'core-banking', 'published', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO nodes (id, flow_id, node_key, name, node_type, title, description, pos_x, pos_y, owner_team, tags, notes)
VALUES
('00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000201','api-gateway','API Gateway','API','API Gateway','Public entry point for account creation',80,120,'channel-platform',ARRAY['entry','http'],'Customer request enters here'),
('00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000201','account-orchestrator','Account Orchestrator','Microservice','Account Orchestrator','Coordinates profile lookup, cache, risk, persistence, and event publication',360,120,'account-platform',ARRAY['orchestrator'],'Primary service for create_account'),
('00000000-0000-0000-0000-000000000303','00000000-0000-0000-0000-000000000201','customer-profile','Customer Profile Service','Microservice','Customer Profile Service','Fetches customer KYC and contact attributes',680,40,'customer-domain',ARRAY['profile'],'Response includes kycStatus and email'),
('00000000-0000-0000-0000-000000000304','00000000-0000-0000-0000-000000000201','redis-cache','Redis Cache','Cache','Redis Cache','Idempotency and cached account lookup',680,240,'platform',ARRAY['cache'],'Used for cache-hit short circuit'),
('00000000-0000-0000-0000-000000000305','00000000-0000-0000-0000-000000000201','risk-engine','Risk Engine','External API','Risk Engine','External policy and scoring service',980,40,'risk-partner',ARRAY['external','risk'],'Approves or rejects onboarding'),
('00000000-0000-0000-0000-000000000306','00000000-0000-0000-0000-000000000201','vault-core','Vault Core DB','Database','Vault Core DB','System-of-record database for account state',980,250,'core-data',ARRAY['db'],'Persists accountId, customerId, balance, and ledgerId'),
('00000000-0000-0000-0000-000000000307','00000000-0000-0000-0000-000000000201','ledger-service','Ledger Service','Microservice','Ledger Service','Creates the opening ledger and account number',1270,250,'ledger-domain',ARRAY['ledger'],'Returns ledgerId and accountNumber'),
('00000000-0000-0000-0000-000000000308','00000000-0000-0000-0000-000000000201','account-events','Account Events','Queue','Account Events','Kafka topic for account lifecycle messages',1270,70,'event-platform',ARRAY['event','kafka'],'Publishes account_created payloads'),
('00000000-0000-0000-0000-000000000309','00000000-0000-0000-0000-000000000201','notification-service','Notification Service','Microservice','Notification Service','Consumes event and sends customer confirmation',1540,70,'engagement-domain',ARRAY['notification'],'Uses email from the published event'),

('00000000-0000-0000-0000-000000000331','00000000-0000-0000-0000-000000000202','balance-api','Balance API','API','Balance API','Entry point for balance inquiry',100,140,'channel-platform',ARRAY['entry'],'Balance read starts here'),
('00000000-0000-0000-0000-000000000332','00000000-0000-0000-0000-000000000202','balance-service','Balance Service','Microservice','Balance Service','Resolves current balance',400,140,'account-platform',ARRAY['read'],'Reads cache before DB'),
('00000000-0000-0000-0000-000000000333','00000000-0000-0000-0000-000000000202','balance-cache','Redis Cache','Cache','Redis Cache','Cached balances',700,60,'platform',ARRAY['cache'],'Fast balance lookup'),
('00000000-0000-0000-0000-000000000334','00000000-0000-0000-0000-000000000202','balance-db','Vault Core DB','Database','Vault Core DB','Source of truth for balances',700,220,'core-data',ARRAY['db'],'Fallback when cache misses'),

('00000000-0000-0000-0000-000000000341','00000000-0000-0000-0000-000000000203','transfer-api','Transfer API','API','Transfer API','Entry point for internal transfers',100,160,'channel-platform',ARRAY['entry'],'Transfer request arrives here'),
('00000000-0000-0000-0000-000000000342','00000000-0000-0000-0000-000000000203','transfer-orchestrator','Transfer Orchestrator','Microservice','Transfer Orchestrator','Validates and posts transfer',420,160,'payments-platform',ARRAY['orchestrator'],'Coordinates debit and credit legs'),
('00000000-0000-0000-0000-000000000343','00000000-0000-0000-0000-000000000203','transfer-db','Vault Core DB','Database','Vault Core DB','Posts transfer movements',760,240,'core-data',ARRAY['db'],'Persists transfer state'),
('00000000-0000-0000-0000-000000000344','00000000-0000-0000-0000-000000000203','transfer-events','Transfer Events','Queue','Transfer Events','Publishes transfer-complete messages',760,80,'event-platform',ARRAY['event'],'Used by downstream consumers'),
('00000000-0000-0000-0000-000000000345','00000000-0000-0000-0000-000000000203','transfer-notify','Notification Service','Microservice','Notification Service','Sends transfer confirmation',1060,80,'engagement-domain',ARRAY['notification'],'Downstream transfer notification')
ON CONFLICT (id) DO NOTHING;

UPDATE flows SET entry_node_id='00000000-0000-0000-0000-000000000301' WHERE id='00000000-0000-0000-0000-000000000201';
UPDATE flows SET entry_node_id='00000000-0000-0000-0000-000000000331' WHERE id='00000000-0000-0000-0000-000000000202';
UPDATE flows SET entry_node_id='00000000-0000-0000-0000-000000000341' WHERE id='00000000-0000-0000-0000-000000000203';

INSERT INTO edges (id, flow_id, from_node_id, to_node_id, protocol, endpoint, description)
VALUES
('00000000-0000-0000-0000-000000000401','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000302','http','POST /internal/accounts','Gateway forwards create_account'),
('00000000-0000-0000-0000-000000000402','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000303','grpc','GetCustomerProfile','Load KYC and contact attributes'),
('00000000-0000-0000-0000-000000000403','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000303','00000000-0000-0000-0000-000000000302','grpc','CustomerProfileResult','Profile response returns to orchestrator'),
('00000000-0000-0000-0000-000000000404','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000304','redis','GET account:{accountId}','Check cache before persistence'),
('00000000-0000-0000-0000-000000000405','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000304','00000000-0000-0000-0000-000000000302','redis','CacheResult','Cache result returns to orchestrator'),
('00000000-0000-0000-0000-000000000406','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000305','http','POST /risk/check','Request risk score and decision'),
('00000000-0000-0000-0000-000000000407','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000305','00000000-0000-0000-0000-000000000302','http','RiskDecision','Risk response returns to orchestrator'),
('00000000-0000-0000-0000-000000000408','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000306','sql','INSERT accounts','Persist approved account state'),
('00000000-0000-0000-0000-000000000409','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000307','grpc','CreateLedger','Create opening ledger and account number'),
('00000000-0000-0000-0000-000000000410','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000307','00000000-0000-0000-0000-000000000302','grpc','LedgerCreated','Ledger response returns to orchestrator'),
('00000000-0000-0000-0000-000000000411','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000308','kafka','topic.account.created','Publish account_created event'),
('00000000-0000-0000-0000-000000000412','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000308','00000000-0000-0000-0000-000000000309','kafka','topic.account.created','Notification service consumes account event'),

('00000000-0000-0000-0000-000000000421','00000000-0000-0000-0000-000000000202','00000000-0000-0000-0000-000000000331','00000000-0000-0000-0000-000000000332','http','GET /balances','Forward balance inquiry'),
('00000000-0000-0000-0000-000000000422','00000000-0000-0000-0000-000000000202','00000000-0000-0000-0000-000000000332','00000000-0000-0000-0000-000000000333','redis','GET balance:{accountId}','Check cached balance'),
('00000000-0000-0000-0000-000000000423','00000000-0000-0000-0000-000000000202','00000000-0000-0000-0000-000000000332','00000000-0000-0000-0000-000000000334','sql','SELECT balance','Fallback to source of truth'),

('00000000-0000-0000-0000-000000000431','00000000-0000-0000-0000-000000000203','00000000-0000-0000-0000-000000000341','00000000-0000-0000-0000-000000000342','http','POST /internal-transfer','Transfer request ingress'),
('00000000-0000-0000-0000-000000000432','00000000-0000-0000-0000-000000000203','00000000-0000-0000-0000-000000000342','00000000-0000-0000-0000-000000000343','sql','INSERT transfer_ledger','Persist transfer legs'),
('00000000-0000-0000-0000-000000000433','00000000-0000-0000-0000-000000000203','00000000-0000-0000-0000-000000000342','00000000-0000-0000-0000-000000000344','kafka','topic.transfer.completed','Publish transfer event'),
('00000000-0000-0000-0000-000000000434','00000000-0000-0000-0000-000000000203','00000000-0000-0000-0000-000000000344','00000000-0000-0000-0000-000000000345','kafka','topic.transfer.completed','Notify customer about transfer')
ON CONFLICT (id) DO NOTHING;

INSERT INTO fields (id, node_id, path, field_name, display_name, normalized_name, canonical_name, field_role, sort_order, type, description, source_type, example_value)
VALUES
('00000000-0000-0000-0000-000000000501','00000000-0000-0000-0000-000000000301','request.accountId','accountId','Account ID','requestaccountid','accountid','request',1,'string','Client supplied account identifier','request','ACC-2026-0001'),
('00000000-0000-0000-0000-000000000502','00000000-0000-0000-0000-000000000301','request.customerId','customerId','Customer ID','requestcustomerid','customerid','request',2,'string','Customer identifier','request','CUS-884201'),
('00000000-0000-0000-0000-000000000503','00000000-0000-0000-0000-000000000301','request.initialDeposit','initialDeposit','Initial Deposit','requestinitialdeposit','initialdeposit','request',3,'number','Opening amount','request','5000'),
('00000000-0000-0000-0000-000000000504','00000000-0000-0000-0000-000000000301','request.requestId','requestId','Request ID','requestrequestid','requestid','request',4,'string','Trace identifier','request','REQ-10001'),
('00000000-0000-0000-0000-000000000505','00000000-0000-0000-0000-000000000301','request.channelId','channelId','Channel ID','requestchannelid','channelid','request',5,'string','Originating channel','request','MOBILE'),
('00000000-0000-0000-0000-000000000506','00000000-0000-0000-0000-000000000301','response.accountNumber','accountNumber','Account Number','responseaccountnumber','accountnumber','response',6,'string','Assigned account number','derived','00112345678'),
('00000000-0000-0000-0000-000000000507','00000000-0000-0000-0000-000000000301','response.status','status','Status','responsestatus','status','response',7,'string','Gateway response status','derived','SUCCESS'),
('00000000-0000-0000-0000-000000000508','00000000-0000-0000-0000-000000000301','response.createdAt','createdAt','Created At','responsecreatedat','createdat','response',8,'string','Creation timestamp','derived','2026-03-18T09:00:00Z'),

('00000000-0000-0000-0000-000000000509','00000000-0000-0000-0000-000000000302','request.accountId','accountId','Account ID','requestaccountid','accountid','request',1,'string','Incoming account id','request','ACC-2026-0001'),
('00000000-0000-0000-0000-000000000510','00000000-0000-0000-0000-000000000302','request.customerId','customerId','Customer ID','requestcustomerid','customerid','request',2,'string','Incoming customer id','request','CUS-884201'),
('00000000-0000-0000-0000-000000000511','00000000-0000-0000-0000-000000000302','request.initialDeposit','initialDeposit','Initial Deposit','requestinitialdeposit','initialdeposit','request',3,'number','Incoming opening amount','request','5000'),
('00000000-0000-0000-0000-000000000512','00000000-0000-0000-0000-000000000302','request.requestId','requestId','Request ID','requestrequestid','requestid','request',4,'string','Correlation id','request','REQ-10001'),
('00000000-0000-0000-0000-000000000513','00000000-0000-0000-0000-000000000302','internal.kycStatus','kycStatus','KYC Status','internalkycstatus','kycstatus','internal',5,'string','KYC result from customer profile','derived','VERIFIED'),
('00000000-0000-0000-0000-000000000514','00000000-0000-0000-0000-000000000302','internal.customerEmail','customerEmail','Customer Email','internalcustomeremail','customeremail','internal',6,'string','Email returned from profile service','derived','alex@example.com'),
('00000000-0000-0000-0000-000000000515','00000000-0000-0000-0000-000000000302','internal.cacheHit','cacheHit','Cache Hit','internalcachehit','cachehit','internal',7,'boolean','Whether cache short-circuited onboarding','cache','false'),
('00000000-0000-0000-0000-000000000516','00000000-0000-0000-0000-000000000302','internal.riskScore','riskScore','Risk Score','internalriskscore','riskscore','internal',8,'number','Risk score from external decision','derived','0.12'),
('00000000-0000-0000-0000-000000000517','00000000-0000-0000-0000-000000000302','internal.riskDecision','riskDecision','Risk Decision','internalriskdecision','riskdecision','internal',9,'string','Risk approval state','derived','APPROVE'),
('00000000-0000-0000-0000-000000000518','00000000-0000-0000-0000-000000000302','response.accountNumber','accountNumber','Account Number','responseaccountnumber','accountnumber','response',10,'string','Generated account number','derived','00112345678'),
('00000000-0000-0000-0000-000000000519','00000000-0000-0000-0000-000000000302','response.ledgerId','ledgerId','Ledger ID','responseledgerid','ledgerid','response',11,'string','Ledger identifier created downstream','derived','LED-779201'),
('00000000-0000-0000-0000-000000000520','00000000-0000-0000-0000-000000000302','response.status','status','Status','responsestatus','status','response',12,'string','Overall orchestration status','derived','SUCCESS'),

('00000000-0000-0000-0000-000000000521','00000000-0000-0000-0000-000000000303','request.customerId','customerId','Customer ID','requestcustomerid','customerid','request',1,'string','Profile lookup key','request','CUS-884201'),
('00000000-0000-0000-0000-000000000522','00000000-0000-0000-0000-000000000303','response.customerId','customerId','Customer ID','responsecustomerid','customerid','response',2,'string','Resolved customer id','db','CUS-884201'),
('00000000-0000-0000-0000-000000000523','00000000-0000-0000-0000-000000000303','response.kycStatus','kycStatus','KYC Status','responsekycstatus','kycstatus','response',3,'string','KYC verification status','db','VERIFIED'),
('00000000-0000-0000-0000-000000000524','00000000-0000-0000-0000-000000000303','response.segment','segment','Segment','responsesegment','segment','response',4,'string','Customer segment','db','MASS'),
('00000000-0000-0000-0000-000000000525','00000000-0000-0000-0000-000000000303','response.email','email','Email','responseemail','email','response',5,'string','Preferred notification email','db','alex@example.com'),

('00000000-0000-0000-0000-000000000526','00000000-0000-0000-0000-000000000304','request.accountId','accountId','Account ID','requestaccountid','accountid','request',1,'string','Cache lookup key','request','ACC-2026-0001'),
('00000000-0000-0000-0000-000000000527','00000000-0000-0000-0000-000000000304','response.cacheHit','cacheHit','Cache Hit','responsecachehit','cachehit','response',2,'boolean','Whether account already exists in cache','cache','false'),
('00000000-0000-0000-0000-000000000528','00000000-0000-0000-0000-000000000304','response.accountNumber','accountNumber','Account Number','responseaccountnumber','accountnumber','response',3,'string','Cached account number when present','cache','00112345678'),
('00000000-0000-0000-0000-000000000529','00000000-0000-0000-0000-000000000304','response.customerId','customerId','Customer ID','responsecustomerid','customerid','response',4,'string','Cached customer id when present','cache','CUS-884201'),

('00000000-0000-0000-0000-000000000530','00000000-0000-0000-0000-000000000305','request.customerId','customerId','Customer ID','requestcustomerid','customerid','request',1,'string','Risk request customer id','request','CUS-884201'),
('00000000-0000-0000-0000-000000000531','00000000-0000-0000-0000-000000000305','request.accountId','accountId','Account ID','requestaccountid','accountid','request',2,'string','Risk request account id','request','ACC-2026-0001'),
('00000000-0000-0000-0000-000000000532','00000000-0000-0000-0000-000000000305','request.amount','amount','Amount','requestamount','amount','request',3,'number','Initial deposit evaluated by risk engine','request','5000'),
('00000000-0000-0000-0000-000000000533','00000000-0000-0000-0000-000000000305','response.riskScore','riskScore','Risk Score','responseriskscore','riskscore','response',4,'number','Calculated risk score','external','0.12'),
('00000000-0000-0000-0000-000000000534','00000000-0000-0000-0000-000000000305','response.riskDecision','riskDecision','Risk Decision','responseriskdecision','riskdecision','response',5,'string','Approve or reject decision','external','APPROVE'),

('00000000-0000-0000-0000-000000000535','00000000-0000-0000-0000-000000000306','db.accountId','accountId','Account ID','dbaccountid','accountid','db_column',1,'string','Persisted account id','db','ACC-2026-0001'),
('00000000-0000-0000-0000-000000000536','00000000-0000-0000-0000-000000000306','db.customerId','customerId','Customer ID','dbcustomerid','customerid','db_column',2,'string','Persisted customer id','db','CUS-884201'),
('00000000-0000-0000-0000-000000000537','00000000-0000-0000-0000-000000000306','db.accountNumber','accountNumber','Account Number','dbaccountnumber','accountnumber','db_column',3,'string','Persisted account number','db','00112345678'),
('00000000-0000-0000-0000-000000000538','00000000-0000-0000-0000-000000000306','db.ledgerId','ledgerId','Ledger ID','dbledgerid','ledgerid','db_column',4,'string','Persisted ledger id','db','LED-779201'),
('00000000-0000-0000-0000-000000000539','00000000-0000-0000-0000-000000000306','db.status','status','Status','dbstatus','status','db_column',5,'string','Persisted account status','db','ACTIVE'),
('00000000-0000-0000-0000-000000000540','00000000-0000-0000-0000-000000000306','db.balance','balance','Balance','dbbalance','balance','db_column',6,'number','Opening balance','db','5000'),

('00000000-0000-0000-0000-000000000541','00000000-0000-0000-0000-000000000307','request.accountId','accountId','Account ID','requestaccountid','accountid','request',1,'string','Ledger request account id','request','ACC-2026-0001'),
('00000000-0000-0000-0000-000000000542','00000000-0000-0000-0000-000000000307','request.customerId','customerId','Customer ID','requestcustomerid','customerid','request',2,'string','Ledger request customer id','request','CUS-884201'),
('00000000-0000-0000-0000-000000000543','00000000-0000-0000-0000-000000000307','request.initialDeposit','initialDeposit','Initial Deposit','requestinitialdeposit','initialdeposit','request',3,'number','Opening amount','request','5000'),
('00000000-0000-0000-0000-000000000544','00000000-0000-0000-0000-000000000307','response.ledgerId','ledgerId','Ledger ID','responseledgerid','ledgerid','response',4,'string','Ledger identifier','derived','LED-779201'),
('00000000-0000-0000-0000-000000000545','00000000-0000-0000-0000-000000000307','response.accountNumber','accountNumber','Account Number','responseaccountnumber','accountnumber','response',5,'string','Generated account number','derived','00112345678'),

('00000000-0000-0000-0000-000000000546','00000000-0000-0000-0000-000000000308','event.accountId','accountId','Account ID','eventaccountid','accountid','event_payload',1,'string','Published event account id','derived','ACC-2026-0001'),
('00000000-0000-0000-0000-000000000547','00000000-0000-0000-0000-000000000308','event.customerId','customerId','Customer ID','eventcustomerid','customerid','event_payload',2,'string','Published event customer id','derived','CUS-884201'),
('00000000-0000-0000-0000-000000000548','00000000-0000-0000-0000-000000000308','event.accountNumber','accountNumber','Account Number','eventaccountnumber','accountnumber','event_payload',3,'string','Published event account number','derived','00112345678'),
('00000000-0000-0000-0000-000000000549','00000000-0000-0000-0000-000000000308','event.eventType','eventType','Event Type','eventeventtype','eventtype','event_payload',4,'string','Published event name','constant','account_created'),
('00000000-0000-0000-0000-000000000550','00000000-0000-0000-0000-000000000308','event.email','email','Email','eventemail','email','event_payload',5,'string','Customer email attached for downstream notification','derived','alex@example.com'),

('00000000-0000-0000-0000-000000000551','00000000-0000-0000-0000-000000000309','request.accountId','accountId','Account ID','requestaccountid','accountid','request',1,'string','Notification payload account id','request','ACC-2026-0001'),
('00000000-0000-0000-0000-000000000552','00000000-0000-0000-0000-000000000309','request.customerId','customerId','Customer ID','requestcustomerid','customerid','request',2,'string','Notification payload customer id','request','CUS-884201'),
('00000000-0000-0000-0000-000000000553','00000000-0000-0000-0000-000000000309','request.eventType','eventType','Event Type','requesteventtype','eventtype','request',3,'string','Consumed event name','request','account_created'),
('00000000-0000-0000-0000-000000000554','00000000-0000-0000-0000-000000000309','request.email','email','Email','requestemail','email','request',4,'string','Email destination','request','alex@example.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO field_mappings (id, edge_id, flow_id, source_node_id, source_field_id, target_node_id, target_field_id, mapping_type, transform_rule, condition, notes, confidence, link_type)
VALUES
('00000000-0000-0000-0000-000000000601','00000000-0000-0000-0000-000000000401','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000501','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000509','DIRECT','','','Forward accountId to orchestrator',1,'manual'),
('00000000-0000-0000-0000-000000000602','00000000-0000-0000-0000-000000000401','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000502','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000510','DIRECT','','','Forward customerId to orchestrator',1,'manual'),
('00000000-0000-0000-0000-000000000603','00000000-0000-0000-0000-000000000401','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000503','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000511','DIRECT','','','Forward initialDeposit to orchestrator',1,'manual'),
('00000000-0000-0000-0000-000000000604','00000000-0000-0000-0000-000000000401','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000504','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000512','DIRECT','','','Forward requestId to orchestrator',1,'manual'),

('00000000-0000-0000-0000-000000000605','00000000-0000-0000-0000-000000000402','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000510','00000000-0000-0000-0000-000000000303','00000000-0000-0000-0000-000000000521','DIRECT','','','Lookup profile by customerId',1,'manual'),

('00000000-0000-0000-0000-000000000606','00000000-0000-0000-0000-000000000403','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000303','00000000-0000-0000-0000-000000000523','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000513','DIRECT','','','Profile response populates kycStatus',1,'manual'),
('00000000-0000-0000-0000-000000000607','00000000-0000-0000-0000-000000000403','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000303','00000000-0000-0000-0000-000000000525','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000514','DIRECT','','','Profile response populates customerEmail',1,'manual'),

('00000000-0000-0000-0000-000000000608','00000000-0000-0000-0000-000000000404','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000509','00000000-0000-0000-0000-000000000304','00000000-0000-0000-0000-000000000526','DIRECT','','','Read cache by accountId',1,'manual'),

('00000000-0000-0000-0000-000000000609','00000000-0000-0000-0000-000000000405','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000304','00000000-0000-0000-0000-000000000527','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000515','DIRECT','','','Cache response sets cacheHit flag',1,'manual'),
('00000000-0000-0000-0000-000000000610','00000000-0000-0000-0000-000000000405','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000304','00000000-0000-0000-0000-000000000528','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000518','DIRECT','','','Cache can short-circuit accountNumber',1,'manual'),

('00000000-0000-0000-0000-000000000611','00000000-0000-0000-0000-000000000406','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000510','00000000-0000-0000-0000-000000000305','00000000-0000-0000-0000-000000000530','DIRECT','','','Risk request customerId',1,'manual'),
('00000000-0000-0000-0000-000000000612','00000000-0000-0000-0000-000000000406','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000509','00000000-0000-0000-0000-000000000305','00000000-0000-0000-0000-000000000531','DIRECT','','','Risk request accountId',1,'manual'),
('00000000-0000-0000-0000-000000000613','00000000-0000-0000-0000-000000000406','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000511','00000000-0000-0000-0000-000000000305','00000000-0000-0000-0000-000000000532','TRANSFORM','toDecimal(initialDeposit)','','Risk request amount from initialDeposit',1,'manual'),

('00000000-0000-0000-0000-000000000614','00000000-0000-0000-0000-000000000407','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000305','00000000-0000-0000-0000-000000000533','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000516','DIRECT','','','Risk response populates riskScore',1,'manual'),
('00000000-0000-0000-0000-000000000615','00000000-0000-0000-0000-000000000407','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000305','00000000-0000-0000-0000-000000000534','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000517','DIRECT','','','Risk response populates riskDecision',1,'manual'),

('00000000-0000-0000-0000-000000000616','00000000-0000-0000-0000-000000000408','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000509','00000000-0000-0000-0000-000000000306','00000000-0000-0000-0000-000000000535','DIRECT','','','Persist accountId',1,'manual'),
('00000000-0000-0000-0000-000000000617','00000000-0000-0000-0000-000000000408','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000510','00000000-0000-0000-0000-000000000306','00000000-0000-0000-0000-000000000536','DIRECT','','','Persist customerId',1,'manual'),
('00000000-0000-0000-0000-000000000618','00000000-0000-0000-0000-000000000408','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000511','00000000-0000-0000-0000-000000000306','00000000-0000-0000-0000-000000000540','TRANSFORM','openingBalance(initialDeposit)','','Persist opening balance',1,'manual'),
('00000000-0000-0000-0000-000000000619','00000000-0000-0000-0000-000000000408','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000517','00000000-0000-0000-0000-000000000306','00000000-0000-0000-0000-000000000539','DERIVED','approved -> ACTIVE','riskDecision=APPROVE','Persist account status when approved',1,'manual'),

('00000000-0000-0000-0000-000000000620','00000000-0000-0000-0000-000000000409','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000509','00000000-0000-0000-0000-000000000307','00000000-0000-0000-0000-000000000541','DIRECT','','','Ledger request accountId',1,'manual'),
('00000000-0000-0000-0000-000000000621','00000000-0000-0000-0000-000000000409','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000510','00000000-0000-0000-0000-000000000307','00000000-0000-0000-0000-000000000542','DIRECT','','','Ledger request customerId',1,'manual'),
('00000000-0000-0000-0000-000000000622','00000000-0000-0000-0000-000000000409','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000511','00000000-0000-0000-0000-000000000307','00000000-0000-0000-0000-000000000543','DIRECT','','','Ledger request initialDeposit',1,'manual'),

('00000000-0000-0000-0000-000000000623','00000000-0000-0000-0000-000000000410','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000307','00000000-0000-0000-0000-000000000544','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000519','DIRECT','','','Ledger response populates ledgerId',1,'manual'),
('00000000-0000-0000-0000-000000000624','00000000-0000-0000-0000-000000000410','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000307','00000000-0000-0000-0000-000000000545','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000518','DIRECT','','','Ledger response populates accountNumber',1,'manual'),

('00000000-0000-0000-0000-000000000625','00000000-0000-0000-0000-000000000411','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000509','00000000-0000-0000-0000-000000000308','00000000-0000-0000-0000-000000000546','DIRECT','','','Event accountId',1,'manual'),
('00000000-0000-0000-0000-000000000626','00000000-0000-0000-0000-000000000411','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000510','00000000-0000-0000-0000-000000000308','00000000-0000-0000-0000-000000000547','DIRECT','','','Event customerId',1,'manual'),
('00000000-0000-0000-0000-000000000627','00000000-0000-0000-0000-000000000411','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000518','00000000-0000-0000-0000-000000000308','00000000-0000-0000-0000-000000000548','DIRECT','','','Event accountNumber',1,'manual'),
('00000000-0000-0000-0000-000000000628','00000000-0000-0000-0000-000000000411','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000302',NULL,'00000000-0000-0000-0000-000000000308','00000000-0000-0000-0000-000000000549','CONSTANT','"account_created"','','Constant event type',1,'manual'),
('00000000-0000-0000-0000-000000000629','00000000-0000-0000-0000-000000000411','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000514','00000000-0000-0000-0000-000000000308','00000000-0000-0000-0000-000000000550','DIRECT','','','Event carries customer email',1,'manual'),

('00000000-0000-0000-0000-000000000630','00000000-0000-0000-0000-000000000412','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000308','00000000-0000-0000-0000-000000000546','00000000-0000-0000-0000-000000000309','00000000-0000-0000-0000-000000000551','DIRECT','','','Notification request accountId',1,'manual'),
('00000000-0000-0000-0000-000000000631','00000000-0000-0000-0000-000000000412','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000308','00000000-0000-0000-0000-000000000547','00000000-0000-0000-0000-000000000309','00000000-0000-0000-0000-000000000552','DIRECT','','','Notification request customerId',1,'manual'),
('00000000-0000-0000-0000-000000000632','00000000-0000-0000-0000-000000000412','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000308','00000000-0000-0000-0000-000000000549','00000000-0000-0000-0000-000000000309','00000000-0000-0000-0000-000000000553','DIRECT','','','Notification request eventType',1,'manual'),
('00000000-0000-0000-0000-000000000633','00000000-0000-0000-0000-000000000412','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000308','00000000-0000-0000-0000-000000000550','00000000-0000-0000-0000-000000000309','00000000-0000-0000-0000-000000000554','DIRECT','','','Notification request email',1,'manual')
ON CONFLICT (id) DO NOTHING;

INSERT INTO field_concepts (id, flow_id, concept_key, display_name, description)
VALUES
('00000000-0000-0000-0000-000000000801','00000000-0000-0000-0000-000000000201','accountid','Account ID','Canonical concept representing the account identifier across services'),
('00000000-0000-0000-0000-000000000802','00000000-0000-0000-0000-000000000201','customerid','Customer ID','Canonical concept representing the customer identifier across services')
ON CONFLICT (id) DO NOTHING;

INSERT INTO field_concept_links (id, concept_id, field_id, confidence, link_type)
VALUES
('00000000-0000-0000-0000-000000000811','00000000-0000-0000-0000-000000000801','00000000-0000-0000-0000-000000000501',1,'manual'),
('00000000-0000-0000-0000-000000000812','00000000-0000-0000-0000-000000000801','00000000-0000-0000-0000-000000000509',1,'manual'),
('00000000-0000-0000-0000-000000000813','00000000-0000-0000-0000-000000000801','00000000-0000-0000-0000-000000000531',1,'manual'),
('00000000-0000-0000-0000-000000000814','00000000-0000-0000-0000-000000000801','00000000-0000-0000-0000-000000000535',1,'manual'),
('00000000-0000-0000-0000-000000000815','00000000-0000-0000-0000-000000000801','00000000-0000-0000-0000-000000000546',1,'manual'),
('00000000-0000-0000-0000-000000000816','00000000-0000-0000-0000-000000000802','00000000-0000-0000-0000-000000000502',1,'manual'),
('00000000-0000-0000-0000-000000000817','00000000-0000-0000-0000-000000000802','00000000-0000-0000-0000-000000000510',1,'manual'),
('00000000-0000-0000-0000-000000000818','00000000-0000-0000-0000-000000000802','00000000-0000-0000-0000-000000000521',1,'manual'),
('00000000-0000-0000-0000-000000000819','00000000-0000-0000-0000-000000000802','00000000-0000-0000-0000-000000000536',1,'manual'),
('00000000-0000-0000-0000-000000000820','00000000-0000-0000-0000-000000000802','00000000-0000-0000-0000-000000000547',1,'manual')
ON CONFLICT (id) DO NOTHING;

INSERT INTO notes (id, flow_id, node_id, content, width, height, position_x, position_y)
VALUES
('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000201', NULL, 'KYC must be VERIFIED and riskDecision must be APPROVE before the account is persisted to Vault Core.', 320, 180, 560, 380),
('00000000-0000-0000-0000-000000000702', '00000000-0000-0000-0000-000000000201', NULL, 'accountId and customerId should highlight a long lineage chain across API, orchestrator, risk, DB, event, and notification nodes.', 300, 170, 1210, 360)
ON CONFLICT (id) DO NOTHING;
`
