// api/db.js — Paylaşılan DB bağlantı helper'ı
import postgres from 'postgres'

let sql

export function getDb() {
  if (!sql) {
    sql = postgres(process.env.POSTGRES_URL, {
      ssl: 'require',
      max: 1,
      idle_timeout: 20,
    })
  }
  return sql
}
