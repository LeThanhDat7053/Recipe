import { useState } from 'react'
import { ChevronDown, Ellipsis, Eraser, Plus, Share2, Trash2, X } from 'lucide-react'
import { useStore } from '../store'
import { useToast } from '../components/Toast'
import { CheckCircle, ConfirmSheet, EmptyState, MenuItem, PageHeader, Sheet } from '../components/ui'
import { cx, shareOrCopy } from '../lib/utils'

export default function Shopping() {
  const { shoppingItems, addShoppingText, toggleShopping, removeShopping } = useStore()
  const toast = useToast()
  const [text, setText] = useState('')
  const [menu, setMenu] = useState(false)
  const [confirmAll, setConfirmAll] = useState(false)
  const [showDone, setShowDone] = useState(true)

  const todo = shoppingItems.filter((i) => !i.checked)
  const done = shoppingItems.filter((i) => i.checked)

  const run = async (fn) => {
    try {
      await fn()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const add = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    run(() => addShoppingText(text))
    setText('')
  }

  const share = () => {
    if (!todo.length) return toast('Không còn gì cần mua')
    const lines = todo.map((i) => `☐ ${[i.amount, i.unit, i.name].filter(Boolean).join(' ')}`)
    shareOrCopy({ title: 'Danh sách đi chợ', text: `🛒 Danh sách đi chợ\n${lines.join('\n')}` }, toast)
  }

  return (
    <>
      <PageHeader
        title="Đi chợ"
        right={
          shoppingItems.length > 0 && (
            <>
              <button onClick={share} className="icon-btn" aria-label="Gửi danh sách">
                <Share2 size={20} />
              </button>
              <button onClick={() => setMenu(true)} className="icon-btn" aria-label="Thêm">
                <Ellipsis size={22} />
              </button>
            </>
          )
        }
      >
        <form onSubmit={add} className="flex gap-2 px-4 pb-3">
          <input
            className="input"
            placeholder="Thêm thứ cần mua… (VD: 2 bó rau muống)"
            value={text}
            onChange={(e) => setText(e.target.value)}
            enterKeyHint="done"
          />
          <button className="btn-primary px-4 shrink-0" disabled={!text.trim()} aria-label="Thêm">
            <Plus size={22} />
          </button>
        </form>
      </PageHeader>

      {shoppingItems.length === 0 ? (
        <EmptyState
          emoji="🛒"
          title="Danh sách trống"
          text='Mở một công thức và bấm "Thêm vào đi chợ", hoặc tự thêm ở ô phía trên.'
        />
      ) : (
        <div className="px-4">
          {todo.length > 0 ? (
            <>
              <p className="pt-1 pb-1 text-sm text-muted">{todo.length} thứ cần mua</p>
              <ul>
                {todo.map((item) => (
                  <Item key={item.id} item={item} onToggle={() => run(() => toggleShopping(item))} onRemove={() => run(() => removeShopping([item.id]))} />
                ))}
              </ul>
            </>
          ) : (
            <p className="py-6 text-center font-medium text-ok">🎉 Đã mua đủ hết rồi!</p>
          )}

          {done.length > 0 && (
            <section className="pt-6">
              <button onClick={() => setShowDone((v) => !v)} className="w-full flex items-center gap-2 py-2 text-sm font-semibold text-muted">
                Đã mua ({done.length})
                <ChevronDown size={16} className={cx('transition', !showDone && '-rotate-90')} />
                <span className="flex-1" />
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation()
                    run(() => removeShopping(done.map((i) => i.id)))
                  }}
                  className="text-brand font-medium"
                >
                  Xoá mục đã mua
                </span>
              </button>
              {showDone && (
                <ul>
                  {done.map((item) => (
                    <Item key={item.id} item={item} onToggle={() => run(() => toggleShopping(item))} onRemove={() => run(() => removeShopping([item.id]))} />
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}

      <Sheet open={menu} onClose={() => setMenu(false)}>
        <div className="pt-2">
          <MenuItem icon={Share2} label="Gửi danh sách" hint="Qua Zalo, Messenger, tin nhắn…" onClick={() => (setMenu(false), share())} />
          <MenuItem
            icon={Eraser}
            label="Xoá mục đã mua"
            onClick={() => {
              setMenu(false)
              run(() => removeShopping(done.map((i) => i.id)))
            }}
          />
          <MenuItem icon={Trash2} label="Xoá toàn bộ danh sách" danger onClick={() => (setMenu(false), setConfirmAll(true))} />
        </div>
      </Sheet>
      <ConfirmSheet
        open={confirmAll}
        onClose={() => setConfirmAll(false)}
        danger
        title="Xoá toàn bộ danh sách?"
        confirmText="Xoá hết"
        onConfirm={() => {
          setConfirmAll(false)
          run(() => removeShopping(shoppingItems.map((i) => i.id)))
        }}
      />
    </>
  )
}

function Item({ item, onToggle, onRemove }) {
  return (
    <li className="flex items-center gap-1 border-b border-line">
      <button onClick={onToggle} className="flex-1 min-w-0 flex items-center gap-3 py-3 pl-1 text-left active:opacity-60">
        <CheckCircle on={item.checked} />
        <span className="min-w-0">
          <span className={cx('block leading-snug', item.checked && 'line-through text-muted')}>
            {(item.amount || item.unit) && (
              <b className="font-semibold mr-1.5">
                {item.amount} {item.unit}
              </b>
            )}
            {item.name}
          </span>
          {item.recipe_title && <span className="block text-xs text-muted truncate mt-0.5">{item.recipe_title}</span>}
        </span>
      </button>
      <button onClick={onRemove} className="icon-btn size-10 text-muted" aria-label="Xoá">
        <X size={18} />
      </button>
    </li>
  )
}
