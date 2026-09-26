import type { ReactNode } from 'react'

interface StatusMessageProps {
  title: string
  detail?: ReactNode
  action?: ReactNode
  /** 'status' for polite progress updates, 'alert' for errors. */
  role?: 'status' | 'alert'
}

export function StatusMessage({ title, detail, action, role }: StatusMessageProps) {
  return (
    <div className="status" role={role}>
      <p className="status-title">{title}</p>
      {detail !== undefined && <div className="status-detail">{detail}</div>}
      {action !== undefined && <div className="status-action">{action}</div>}
    </div>
  )
}
