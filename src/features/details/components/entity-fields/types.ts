export interface FieldRow {
  label: string
  value: string
  path?: string
}

export interface FieldGroup {
  title: string
  rows: FieldRow[]
}

