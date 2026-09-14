import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Ellipsis, Eraser, Plus, Share2, Trash2, Wallet, X } from 'lucide-react'
import { useStore } from '../store'
import { useToast } from '../components/Toast'
import { PriceSheet } from '../components/PriceSheet'
import { CheckCircle, ConfirmSheet, EmptyState, MenuItem, PageHeader, Sheet, Switch } from '../components/ui'
import { cx, formatVnd, shareOrCopy } from '../lib/utils'

const ASK_KEY = 'recipebook:ask-price'
const readAsk = () => {
  try {
    return localStorage.getItem(ASK_KEY) !== '0'
  } catch {
    return true
  }
}

export default function Shopping() {
  const { shoppingItems, purchases, addShoppingText, toggleShopping, removeShopping, savePurchase, deletePurchase } = useStore()
  const toast = useToast()
  const [text, setText] = useState('')
  const [menu, setMenu] = useState(false)
  const [confirmAll, setConfirmAll] = useState(false)
  const [showDone, setShowDone] = useState(true)
  const [askPrice, setAskPrice] = useState(readAsk)
  const [priceFor, setPriceFor] = useState(null) // { item, purchase? }

  const todo = shoppingItems.filter((i) => !i.checked)
  const done = shoppingItems.filter((i) => i.checked)
  const purchaseByItem = useMemo(() => {
    const map = {}
    purchases.forEach((p) => {
      if (p.shopping_item_id && !map[p.shopping_item_id]) map[p.shopping_item_id] = p
    })
    return map
  }, [purchases])
  const doneTotal = done.reduce((s, i) => s + (purchaseByItem[i.id]?.price || 0), 0)

  const run = async (fn) => {
    try {
      return await fn()
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

  const onToggle = (item) =>
    run(async () => {
      const checked = await toggleShopping(item)
      if (checked && askPrice) setPriceFor({ item })
    })

  const savePrice = (price) => {
    const { item, purchase } = priceFor
    setPriceFor(null)
    run(async () => {
      await savePurchase({
        ...(purchase || {}),
        shopping_item_id: item.id,
        name: item.name,
        amount: item.amount,
        unit: item.unit,
        recipe_title: item.recipe_title,
        price,
      })
      toast(`Đã ghi ${formatVnd(price)} vào sổ tiền chợ`)
    })
  }

  const removePrice = () => {
    const { purchase } = priceFor
    setPriceFor(null)
    run(() => deletePurchase(purchase.id))
  }

  const setAsk = (v) => {
    setAskPrice(v)
    try {
      localStorage.setItem(ASK_KEY, v ? '1' : '0')
    } catch { /* ignore */ }
  }

  const clearDone = () =>
    run(async () => {
      await removeShopping(done.map((i) => i.id))
      if (doneTotal) toast('Đã xoá khỏi danh sách · giá vẫn giữ trong sổ tiền chợ')
    })

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
          <>
            <Link to="/expenses" className="icon-btn" aria-label="Sổ tiền chợ">
              <Wallet size={20} />
            </Link>
            {shoppingItems.length > 0 && (
              <button onClick={share} className="icon-btn" aria-label="Gửi danh sách">
                <Share2 size={20} />
              </button>
            )}
            <button onClick={() => setMenu(true)} className="icon-btn" aria-label="Thêm">
              <Ellipsis size={22} />
            </button>
          </>
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
          action={
            <Link to="/expenses" className="btn-soft px-5">
              <Wallet size={18} /> Xem sổ tiền chợ
            </Link>
          }
        />
      ) : (
        <div className="px-4">
          {todo.length > 0 ? (
            <>
              <p className="pt-1 pb-1 text-sm text-muted">{todo.length} thứ cần mua</p>
              <ul>
                {todo.map((item) => (
                  <Item key={item.id} item={item} onToggle={() => onToggle(item)} onRemove={() => run(() => removeShopping([item.id]))} />
                ))}
              </ul>
            </>
          ) : (
            <p className="py-6 text-center font-medium text-ok">🎉 Đã mua đủ hết rồi!</p>
          )}

          {done.length > 0 && (
            <section className="pt-6">
              <div className="flex items-center gap-2 py-2">
                <button onClick={() => setShowDone((v) => !v)} className="flex items-center gap-1.5 text-sm font-semibold text-muted">
                  Đã mua ({done.length})
                  {doneTotal > 0 && <span className="text-ink">· {formatVnd(doneTotal)}</span>}
                  <ChevronDown size={16} className={cx('transition', !showDone && '-rotate-90')} />
                </button>
                <span className="flex-1" />
                <button onClick={clearDone} className="text-sm text-brand font-medium">
                  Xoá mục đã mua
                </button>
              </div>
              {showDone && (
                <ul>
                  {done.map((item) => (
                    <Item
                      key={item.id}
                      item={item}
                      price={purchaseByItem[item.id]?.price}
                      onPrice={() => setPriceFor({ item, purchase: purchaseByItem[item.id] })}
                      onToggle={() => onToggle(item)}
                      onRemove={() => run(() => removeShopping([item.id]))}
                    />
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}

      <Sheet open={menu} onClose={() => setMenu(false)}>
        <div className="pt-2">
          <div className="flex items-center gap-3 py-2.5">
            <span className="grid place-items-center size-10 shrink-0 rounded-full bg-surface-2">💰</span>
            <span className="flex-1 min-w-0">
              <span className="block font-medium">Hỏi giá khi tick đã mua</span>
              <span className="block text-sm text-muted">Ghi vào sổ tiền chợ</span>
            </span>
            <Switch checked={askPrice} onChange={setAsk} label="Hỏi giá khi tick" />
          </div>
          <Link to="/expenses" onClick={() => setMenu(false)} className="block">
            <MenuItem icon={Wallet} label="Sổ tiền chợ" hint="Xem tiền chợ theo tuần, tháng" />
          </Link>
          {shoppingItems.length > 0 && (
            <>
              <MenuItem icon={Share2} label="Gửi danh sách" hint="Qua Zalo, Messenger, tin nhắn…" onClick={() => (setMenu(false), share())} />
              <MenuItem icon={Eraser} label="Xoá mục đã mua" onClick={() => (setMenu(false), clearDone())} />
              <MenuItem icon={Trash2} label="Xoá toàn bộ danh sách" danger onClick={() => (setMenu(false), setConfirmAll(true))} />
            </>
          )}
        </div>
      </Sheet>
      <ConfirmSheet
        open={confirmAll}
        onClose={() => setConfirmAll(false)}
        danger
        title="Xoá toàn bộ danh sách?"
        message="Giá đã ghi vẫn được giữ trong sổ tiền chợ."
        confirmText="Xoá hết"
        onConfirm={() => {
          setConfirmAll(false)
          run(() => removeShopping(shoppingItems.map((i) => i.id)))
        }}
      />
      <PriceSheet
        open={!!priceFor}
        onClose={() => setPriceFor(null)}
        item={priceFor?.item}
        purchase={priceFor?.purchase}
        onSave={savePrice}
        onDelete={removePrice}
      />
    </>
  )
}

function Item({ item, price, onPrice, onToggle, onRemove }) {
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
      {item.checked && (
        <button
          onClick={onPrice}
          className={cx(
            'shrink-0 h-8 px-2.5 rounded-full text-xs font-semibold tabular-nums transition active:scale-95',
            price ? 'bg-surface-2 text-ink' : 'text-brand',
          )}
        >
          {price ? formatVnd(price) : '+ Giá'}
        </button>
      )}
      <button onClick={onRemove} className="icon-btn size-10 text-muted" aria-label="Xoá">
        <X size={18} />
      </button>
    </li>
  )
}
