const n=`---
title: "Json Query in PostgreSQL for domain_event_entry in Axon Framework"
date: 2024-08-09
id: blog0310
tag: sql, axon-framework
toc: false
intro: "We record useful query for debugging of domain events with json payload."
---

<style>
  img {
    max-width: 660px;
  }
</style>


\`\`\`sql
select 
  sequence_number,
  type as aggregate,
  REPLACE(payload_type, 'com.machingclee.payment.command.CommandAndEvents$SubscriptionPlanOrder$', '') as event, 
  encode(payload, 'escape') as payload, 
  time_stamp,
  aggregate_identifier
from 
	domain_event_entry
where   
	encode(payload, 'escape')::jsonb->>'orderId' = '019136f9-794b-9a58-ba74-363facf9a814'
order by 
	time_stamp asc
\`\`\`

Result:

[![](/assets/img/2024-08-10-08-34-42.png)](/assets/img/2024-08-10-08-34-42.png)


`;export{n as default};
