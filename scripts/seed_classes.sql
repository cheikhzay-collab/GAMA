INSERT INTO public.classes (id, name, level, students, student_count, competitions, competition_grades, controls, grades, homework, language, program, created_at, updated_at)
VALUES (
  '2BACSPF-1',
  '2BACSPF-1',
  '2bac_pc_svt',
  '[]'::jsonb,
  31,
  '["Test diagnostique 2 Bac sciences"]'::jsonb,
  '{}'::jsonb,
  '["Premier  contrôle","Deuxième  contrôle","Troisième contrôle","Test diagnostique 2 Bac sciences"]'::jsonb,
  '{"H156028102":{"Premier  contrôle":null,"Deuxième  contrôle":null,"Troisième contrôle":null},"M157009199":{"Premier  contrôle":null,"Deuxième  contrôle":null,"Troisième contrôle":null},"M159045820":{"Premier  contrôle":null,"Deuxième  contrôle":null,"Troisième contrôle":null},"N150003772":{"Premier  contrôle":null,"Deuxième  contrôle":null,"Troisième contrôle":null},"N150008405":{"Premier  contrôle":null,"Deuxième  contrôle":null,"Troisième contrôle":null},"N150008414":{"Premier  contrôle":null,"Deuxième  contrôle":null,"Troisième contrôle":null},"N151028626":{"Premier  contrôle":null,"Deuxième  contrôle":null,"Troisième contrôle":null},"N152008436":{"Premier  contrôle":null,"Deuxième  contrôle":null,"Troisième contrôle":null},"N152008452":{"Premier  contrôle":null,"Deuxième  contrôle":null,"Troisième contrôle":null},"N152008459":{"Premier  contrôle":null,"Deuxième  contrôle":null,"Troisième contrôle":null},"N153008498":{"Premier  contrôle":null,"Deuxième  contrôle":null,"Troisième contrôle":null},"N153008499":{"Premier  contrôle":null,"Deuxième  contrôle":null,"Troisième contrôle":null},"N153008501":{"Premier  contrôle":null,"Deuxième  contrôle":null,"Troisième contrôle":null},"N153008503":{"Premier  contrôle":null,"Deuxième  contrôle":null,"Troisième contrôle":null},"N153015802":{"Premier  contrôle":null,"Deuxième  contrôle":null,"Troisième contrôle":null},"N154008477":{"Premier  contrôle":null,"Deuxième  contrôle":null,"Troisième contrôle":null},"N155008518":{"Premier  contrôle":null,"Deuxième  contrôle":null,"Troisième contrôle":null},"N155008541":{"Premier  contrôle":null,"Deuxième  contrôle":null,"Troisième contrôle":null},"N156014463":{"Premier  contrôle":null,"Deuxième  contrôle":null,"Troisième contrôle":null},"N156028636":{"Premier  contrôle":null,"Deuxième  contrôle":null,"Troisième contrôle":null},"N156029457":{"Premier  contrôle":null,"Deuxième  contrôle":null,"Troisième contrôle":null},"N157008389":{"Premier  contrôle":null,"Deuxième  contrôle":null,"Troisième contrôle":null},"N157008399":{"Premier  contrôle":null,"Deuxième  contrôle":null,"Troisième contrôle":null},"N157027058":{"Premier  contrôle":null,"Deuxième  contrôle":null,"Troisième contrôle":null},"N157036623":{"Premier  contrôle":null,"Deuxième  contrôle":null,"Troisième contrôle":null},"N159024066":{"Premier  contrôle":null,"Deuxième  contrôle":null,"Troisième contrôle":null},"S149082902":{"Premier  contrôle":null,"Deuxième  contrôle":null,"Troisième contrôle":null},"S150037886":{"Premier  contrôle":null,"Deuxième  contrôle":null,"Troisième contrôle":null},"S151002573":{"Premier  contrôle":null,"Deuxième  contrôle":null,"Troisième contrôle":null},"S154034486":{"Premier  contrôle":null,"Deuxième  contrôle":null,"Troisième contrôle":null},"S155034487":{"Premier  contrôle":null,"Deuxième  contrôle":null,"Troisième contrôle":null}}'::jsonb,
  '{}'::jsonb,
  'fr',
  '[]'::jsonb,
  '2026-08-16T09:00:49.968Z',
  '2026-08-16T09:01:16.067Z'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  level = EXCLUDED.level,
  students = EXCLUDED.students,
  student_count = EXCLUDED.student_count,
  competitions = EXCLUDED.competitions,
  competition_grades = EXCLUDED.competition_grades,
  controls = EXCLUDED.controls,
  grades = EXCLUDED.grades,
  homework = EXCLUDED.homework,
  language = EXCLUDED.language,
  program = EXCLUDED.program,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.classes (id, name, level, students, student_count, competitions, competition_grades, controls, grades, homework, language, program, created_at, updated_at)
VALUES (
  'TCSF-2',
  'TCSF-2',
  'common_core_sci',
  '[]'::jsonb,
  30,
  '[]'::jsonb,
  '{}'::jsonb,
  '["الفرض الأول","الفرض الثاني","الفرض الثالث"]'::jsonb,
  '{"C161046214":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C165068238":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C170055135":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C170055157":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C171025079":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C171055189":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C171055406":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C171055409":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C171055416":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C171055521":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C171057484":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C172020199":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C172055270":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C172055420":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C172055435":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C173055415":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C173055519":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C173081603":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C175055398":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C175072095":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C176055427":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C176084931":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C177055106":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C177055114":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C178055387":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C179043849":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C179055380":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C179055499":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"E174048655":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"J172004954":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null}}'::jsonb,
  '{}'::jsonb,
  'fr',
  '[]'::jsonb,
  '2026-08-16T08:34:12.103Z',
  '2026-08-31T10:30:11.993Z'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  level = EXCLUDED.level,
  students = EXCLUDED.students,
  student_count = EXCLUDED.student_count,
  competitions = EXCLUDED.competitions,
  competition_grades = EXCLUDED.competition_grades,
  controls = EXCLUDED.controls,
  grades = EXCLUDED.grades,
  homework = EXCLUDED.homework,
  language = EXCLUDED.language,
  program = EXCLUDED.program,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.classes (id, name, level, students, student_count, competitions, competition_grades, controls, grades, homework, language, program, created_at, updated_at)
VALUES (
  'TCSF-1',
  'TCSF-1',
  'common_core_sci',
  '[]'::jsonb,
  30,
  '[]'::jsonb,
  '{}'::jsonb,
  '["الفرض الأول","الفرض الثاني","الفرض الثالث"]'::jsonb,
  '{"B172009185":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C170053737":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C170055133":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C170055438":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C171051491":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C171055167":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C171055408":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C171057483":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C171064413":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C172055422":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C172055433":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C173024780":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C173042283":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C173055108":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C174055267":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C174102925":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C175051101":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C175055158":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C175104752":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C176028135":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C177020389":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C177055221":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C178055194":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C178055392":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C178055477":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C178092815":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C179010401":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C179055379":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"C179055381":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null},"M146108495":{"الفرض الأول":null,"الفرض الثاني":null,"الفرض الثالث":null}}'::jsonb,
  '{}'::jsonb,
  'fr',
  '[]'::jsonb,
  '2026-08-16T08:34:21.562Z',
  '2026-08-31T10:30:11.993Z'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  level = EXCLUDED.level,
  students = EXCLUDED.students,
  student_count = EXCLUDED.student_count,
  competitions = EXCLUDED.competitions,
  competition_grades = EXCLUDED.competition_grades,
  controls = EXCLUDED.controls,
  grades = EXCLUDED.grades,
  homework = EXCLUDED.homework,
  language = EXCLUDED.language,
  program = EXCLUDED.program,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.classes (id, name, level, students, student_count, competitions, competition_grades, controls, grades, homework, language, program, created_at, updated_at)
VALUES (
  'TCLSH-1',
  'TCLSH-1',
  'common_core_arts',
  '[]'::jsonb,
  30,
  '[]'::jsonb,
  '{}'::jsonb,
  '["الفرض الأول","الفرض الثاني"]'::jsonb,
  '{"C161067818":{"الفرض الأول":null,"الفرض الثاني":null},"C161080056":{"الفرض الأول":null,"الفرض الثاني":null},"C163051195":{"الفرض الأول":null,"الفرض الثاني":null},"C164055828":{"الفرض الأول":null,"الفرض الثاني":null},"C164073672":{"الفرض الأول":null,"الفرض الثاني":null},"C165011619":{"الفرض الأول":null,"الفرض الثاني":null},"C165011887":{"الفرض الأول":null,"الفرض الثاني":null},"C165090781":{"الفرض الأول":null,"الفرض الثاني":null},"C166059721":{"الفرض الأول":null,"الفرض الثاني":null},"C166068234":{"الفرض الأول":null,"الفرض الثاني":null},"C167011897":{"الفرض الأول":null,"الفرض الثاني":null},"C169018317":{"الفرض الأول":null,"الفرض الثاني":null},"C169037008":{"الفرض الأول":null,"الفرض الثاني":null},"C169068209":{"الفرض الأول":null,"الفرض الثاني":null},"C170010506":{"الفرض الأول":null,"الفرض الثاني":null},"C170038014":{"الفرض الأول":null,"الفرض الثاني":null},"C171055404":{"الفرض الأول":null,"الفرض الثاني":null},"C172024076":{"الفرض الأول":null,"الفرض الثاني":null},"C172043577":{"الفرض الأول":null,"الفرض الثاني":null},"C172055423":{"الفرض الأول":null,"الفرض الثاني":null},"C173055520":{"الفرض الأول":null,"الفرض الثاني":null},"C176064304":{"الفرض الأول":null,"الفرض الثاني":null},"C178055126":{"الفرض الأول":null,"الفرض الثاني":null},"N140077065":{"الفرض الأول":null,"الفرض الثاني":null},"N141084912":{"الفرض الأول":null,"الفرض الثاني":null},"N147077187":{"الفرض الأول":null,"الفرض الثاني":null},"N150001819":{"الفرض الأول":null,"الفرض الثاني":null},"N150023602":{"الفرض الأول":null,"الفرض الثاني":null},"N158008140":{"الفرض الأول":null,"الفرض الثاني":null},"N159025333":{"الفرض الأول":null,"الفرض الثاني":null}}'::jsonb,
  '{}'::jsonb,
  'fr',
  '[]'::jsonb,
  '2026-08-16T08:34:33.448Z',
  '2026-08-31T10:30:11.993Z'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  level = EXCLUDED.level,
  students = EXCLUDED.students,
  student_count = EXCLUDED.student_count,
  competitions = EXCLUDED.competitions,
  competition_grades = EXCLUDED.competition_grades,
  controls = EXCLUDED.controls,
  grades = EXCLUDED.grades,
  homework = EXCLUDED.homework,
  language = EXCLUDED.language,
  program = EXCLUDED.program,
  updated_at = EXCLUDED.updated_at;