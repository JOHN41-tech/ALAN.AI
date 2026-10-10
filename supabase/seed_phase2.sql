-- Optional idempotent Phase 2 seed data. Contains no student accounts, credentials or private data.
-- The sample jobs intentionally remain unpublished/unverified and must not be presented as live opportunities.
insert into public.phase2_opportunities
  (id,title,company,kind,domain,location,work_mode,skills,description,deadline,source_url,provenance,verification_status,published)
values
  ('00000000-0000-4000-8000-000000000011','Product Engineering Intern','Sample listing — replace before publication','Internship','Software','Remote','Remote',array['React','TypeScript','APIs'],'Development-only example. Replace with an opportunity verified from its original employer source.','2026-11-18','https://example.com/careers','development-seed','unverified',false),
  ('00000000-0000-4000-8000-000000000012','Data Analyst Intern','Sample listing — replace before publication','Internship','Data','Bengaluru, India','Hybrid',array['SQL','Python','Tableau'],'Development-only example. Replace with an opportunity verified from its original employer source.','2026-11-25','https://example.com/jobs','development-seed','unverified',false),
  ('00000000-0000-4000-8000-000000000013','Junior UX Researcher','Sample listing — replace before publication','Part-time','Design','Remote','Remote',array['User research','Figma','Communication'],'Development-only example. Replace with an opportunity verified from its original employer source.','2026-12-02','https://example.com/roles','development-seed','unverified',false),
  ('00000000-0000-4000-8000-000000000014','Cloud Support Associate','Sample listing — replace before publication','Full-time','Cloud','Pune, India','Onsite',array['Linux','Networking','Cloud'],'Development-only example. Replace with an opportunity verified from its original employer source.','2026-12-15','https://example.com/openings','development-seed','unverified',false)
on conflict (id) do update set
  title=excluded.title, company=excluded.company, kind=excluded.kind, domain=excluded.domain,
  location=excluded.location, work_mode=excluded.work_mode, skills=excluded.skills,
  description=excluded.description, deadline=excluded.deadline, source_url=excluded.source_url,
  provenance=excluded.provenance, verification_status=excluded.verification_status, published=false;

insert into public.phase2_resources (id,title,provider,domain,level,resource_type,url,skills,published)
values
  ('00000000-0000-4000-8000-000000000101','React — Quick Start','React Documentation','Web Development','Beginner','Documentation','https://react.dev/learn',array['React','UI'],true),
  ('00000000-0000-4000-8000-000000000102','Python Tutorial','Python.org','AI & Data','Beginner','Tutorial','https://docs.python.org/3/tutorial/',array['Python','Programming'],true),
  ('00000000-0000-4000-8000-000000000103','SQLBolt — Interactive SQL Lessons','SQLBolt','Data Science','Beginner','Practice','https://sqlbolt.com/',array['SQL','Data'],true),
  ('00000000-0000-4000-8000-000000000104','MDN Web Docs','Mozilla','Web Development','Intermediate','Documentation','https://developer.mozilla.org/',array['HTML','CSS','JavaScript'],true),
  ('00000000-0000-4000-8000-000000000105','Machine Learning Crash Course','Google','AI & Data','Intermediate','Course','https://developers.google.com/machine-learning/crash-course',array['Machine Learning','Python'],true),
  ('00000000-0000-4000-8000-000000000106','OWASP Top 10','OWASP Foundation','Cybersecurity','Intermediate','Reference','https://owasp.org/www-project-top-ten/',array['Security','Web'],true)
on conflict (id) do update set title=excluded.title,provider=excluded.provider,domain=excluded.domain,
  level=excluded.level,resource_type=excluded.resource_type,url=excluded.url,skills=excluded.skills,published=true;

insert into public.phase2_assessments (id,slug,title,topic,instructions,published)
values ('00000000-0000-4000-8000-000000000201','core-web-and-data','Core Web & Data Check-in','Web and data fundamentals','Choose one answer per question. Answers are scored privately after submission.',true)
on conflict (slug) do update set title=excluded.title,topic=excluded.topic,instructions=excluded.instructions,published=true;

insert into public.phase2_assessment_questions (id,assessment_id,position,prompt,options,correct_index,explanation,active)
values
 ('00000000-0000-4000-8000-000000000211','00000000-0000-4000-8000-000000000201',1,'Which JavaScript declaration is block-scoped and can be reassigned?','["const","let","static","varies"]'::jsonb,1,'`let` declares a block-scoped binding that can be reassigned.',true),
 ('00000000-0000-4000-8000-000000000212','00000000-0000-4000-8000-000000000201',2,'What does Array.map() return?','["The original array only","A new array","A number","A boolean"]'::jsonb,1,'`map` creates a new array from callback return values.',true),
 ('00000000-0000-4000-8000-000000000213','00000000-0000-4000-8000-000000000201',3,'Which SQL clause filters groups after aggregate calculations?','["WHERE","ORDER BY","HAVING","LIMIT"]'::jsonb,2,'`HAVING` filters grouped rows after aggregates are computed.',true),
 ('00000000-0000-4000-8000-000000000214','00000000-0000-4000-8000-000000000201',4,'Which practice gives a form control an accessible name?','["Use only a placeholder","Associate a visible label","Remove the input name","Use color to identify it"]'::jsonb,1,'A programmatically associated label provides a reliable accessible name.',true),
 ('00000000-0000-4000-8000-000000000215','00000000-0000-4000-8000-000000000201',5,'What does a SQL primary key provide?','["A unique row identifier","Automatic encryption","A query result cache","A user interface"]'::jsonb,0,'A primary key uniquely identifies a row in its table.',true)
on conflict (id) do update set assessment_id=excluded.assessment_id,position=excluded.position,
  prompt=excluded.prompt,options=excluded.options,correct_index=excluded.correct_index,
  explanation=excluded.explanation,active=true;
