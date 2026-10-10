import { saveAcademicRecord } from "@/features/admin/actions";

type Option = { id: string; label: string };
type FieldSpec = { name: string; label: string; type?: "text" | "date" | "number" | "textarea" | "checkbox" | "select"; required?: boolean; value?: string | number | boolean | null; options?: Option[]; placeholder?: string };

export function RecordForm({ entity, title, fields, recordId, submitLabel }: { entity: string; title: string; fields: FieldSpec[]; recordId?: string; submitLabel: string }) {
  return (
    <form action={saveAcademicRecord} className="form-stack" style={{ gap: 12 }}>
      <input type="hidden" name="entity" value={entity} />
      {recordId && <input type="hidden" name="id" value={recordId} />}
      {title && <strong style={{ fontSize: 13 }}>{title}</strong>}
      <div className="record-form-grid">
        {fields.map((field) => <label className="field" key={field.name}>
          <span className="field-label">{field.label}</span>
          {field.type === "textarea" ? <textarea className="textarea" name={field.name} required={field.required} defaultValue={String(field.value ?? "")} maxLength={1000} placeholder={field.placeholder} />
            : field.type === "select" ? <select className="select" name={field.name} required={field.required} defaultValue={String(field.value ?? "")}>
              {!field.required && <option value="">Not set</option>}{field.options?.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
              : field.type === "checkbox" ? <span style={{ display: "flex", alignItems: "center", minHeight: 44, gap: 8 }}><input type="checkbox" name={field.name} defaultChecked={Boolean(field.value)} /> <span style={{ color: "var(--muted)", fontSize: 12 }}>Set as current</span></span>
                : <input className="input" type={field.type ?? "text"} name={field.name} required={field.required} defaultValue={String(field.value ?? "")} min={field.type === "number" ? 0 : undefined} step={field.name === "credits" ? 0.5 : 1} placeholder={field.placeholder} />}
        </label>)}
      </div>
      <button className="button button--primary" type="submit" style={{ justifySelf: "start" }}>{submitLabel}</button>
    </form>
  );
}

export function EntityCatalog({ entity, title, description, records, fields, currentField = "is_active" }: { entity: string; title: string; description: string; records: Record<string, unknown>[]; fields: Omit<FieldSpec, "value">[]; currentField?: string }) {
  return (
    <section className="surface panel admin-catalog">
      <div className="panel-heading"><div><h2>{title}</h2><p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 12 }}>{description}</p></div><span className="badge">{records.length} records</span></div>
      <details className="record-create"><summary className="button button--secondary">Add {title.toLowerCase().replace(/s$/, "")}</summary><div className="record-create-inner"><RecordForm entity={entity} title={`New ${title.toLowerCase().replace(/s$/, "")}`} fields={fields.map((field) => ({ ...field, value: field.type === "checkbox" ? false : "" }))} submitLabel="Save record" /></div></details>
      {!records.length ? <p style={{ margin: "18px 0 0", color: "var(--muted)", fontSize: 13 }}>No records yet. Add the first {title.toLowerCase().replace(/s$/, "")} above.</p> : <div className="catalog-list">
        {records.map((record) => {
          const id = String(record.id);
          const active = Boolean(record[currentField]);
          const label = String(record.name ?? record.title ?? record.code ?? "Academic record");
          const shownFields = fields.map((field) => ({ ...field, value: record[field.name] as string | number | boolean | null }));
          return <article className="catalog-row" key={id}>
            <div className="catalog-summary"><div><strong>{label}</strong><span>{String(record.code ?? record.name ?? id.slice(0, 8))}</span></div><span className={`badge ${active ? "badge--green" : "badge--amber"}`}>{active ? currentField === "is_current" ? "Current" : "Active" : "Inactive"}</span></div>
            <details><summary style={{ color: "var(--cobalt)", cursor: "pointer", fontSize: 12, fontWeight: 650 }}>Edit record</summary><div className="record-create-inner"><RecordForm entity={entity} title="Update details" fields={shownFields} recordId={id} submitLabel="Update record" /></div></details>
          </article>;
        })}
      </div>}
    </section>
  );
}
