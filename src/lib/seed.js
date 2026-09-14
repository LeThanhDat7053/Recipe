import { uid } from './utils'

export function createSeed() {
  const cats = [
    { name: 'Món mặn', icon: '🍖' },
    { name: 'Canh & Súp', icon: '🍲' },
    { name: 'Món xào', icon: '🥘' },
    { name: 'Món chay', icon: '🥗' },
    { name: 'Tráng miệng', icon: '🍮' },
    { name: 'Đồ uống', icon: '🧋' },
  ].map((c, i) => ({ id: uid(), sort_order: i + 1, ...c }))

  const item = (amount, unit, name) => ({ id: uid(), type: 'item', amount, unit, name })
  const group = (name) => ({ id: uid(), type: 'group', amount: '', unit: '', name })
  const step = (text) => ({ id: uid(), text })
  const now = Date.now()

  const recipes = [
    {
      title: 'Thịt kho trứng',
      description: 'Món kho đậm đà, ăn với cơm trắng là hết nồi.',
      category_id: cats[0].id,
      prep_time: 15,
      cook_time: 60,
      servings: 4,
      difficulty: 'easy',
      is_favorite: true,
      tags: ['cơm nhà', 'tết'],
      ingredients: [
        item('500', 'g', 'Thịt ba chỉ'),
        item('6', 'quả', 'Trứng vịt'),
        item('400', 'ml', 'Nước dừa tươi'),
        group('Gia vị'),
        item('2', 'muỗng', 'Nước mắm'),
        item('1', 'muỗng', 'Đường'),
        item('3', 'tép', 'Tỏi băm'),
      ],
      steps: [
        step('Luộc trứng 10 phút, bóc vỏ. Thịt cắt miếng vừa ăn, chần qua nước sôi.'),
        step('Ướp thịt với nước mắm, tỏi và một ít đường khoảng 20 phút.'),
        step('Thắng đường thành màu cánh gián, cho thịt vào đảo săn.'),
        step('Đổ nước dừa ngập thịt, cho trứng vào, kho lửa nhỏ 45–60 phút.'),
      ],
      notes: 'Kho bằng nồi đất sẽ thơm hơn. Để qua đêm ăn càng ngon.',
    },
    {
      title: 'Canh chua cá lóc',
      description: 'Chua ngọt thanh mát kiểu miền Tây.',
      category_id: cats[1].id,
      prep_time: 20,
      cook_time: 20,
      servings: 3,
      difficulty: 'medium',
      is_favorite: false,
      tags: ['miền tây'],
      ingredients: [
        item('1', 'con', 'Cá lóc (~700g)'),
        item('1/2', 'trái', 'Thơm'),
        item('2', 'trái', 'Cà chua'),
        item('100', 'g', 'Giá đỗ'),
        item('1', 'nắm', 'Me chua'),
        item('', '', 'Rau ngổ, ngò gai'),
      ],
      steps: [
        step('Cá làm sạch, cắt khúc, ướp chút muối và tiêu.'),
        step('Dầm me với nước ấm lấy nước cốt.'),
        step('Nấu sôi nước, cho nước me, thơm, cà chua vào.'),
        step('Thả cá vào nấu chín, nêm mắm đường vừa ăn. Tắt bếp cho giá và rau thơm.'),
      ],
      notes: '',
    },
    {
      title: 'Trà đào cam sả',
      description: '',
      category_id: cats[5].id,
      prep_time: 10,
      cook_time: 5,
      servings: 2,
      difficulty: 'easy',
      is_favorite: true,
      tags: ['mùa hè'],
      ingredients: [
        item('2', 'túi', 'Trà đen'),
        item('4', 'miếng', 'Đào ngâm'),
        item('1', 'quả', 'Cam'),
        item('2', 'cây', 'Sả đập dập'),
      ],
      steps: [
        step('Ủ trà với sả trong 300ml nước sôi 5 phút.'),
        step('Thêm nước đào, nước cam, đường tuỳ khẩu vị.'),
        step('Cho đá, đào miếng và lát cam lên trên.'),
      ],
      notes: '',
    },
  ].map((r, i) => ({
    id: uid(),
    image_url: null,
    created_at: new Date(now - i * 86400000).toISOString(),
    updated_at: new Date(now - i * 86400000).toISOString(),
    ...r,
  }))

  return { categories: cats, recipes }
}
