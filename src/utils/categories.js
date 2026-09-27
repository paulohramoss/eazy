// categories — a lista de categorias e seus ícones.
//
// Mora aqui, e não no AppContext, porque o parser do lançamento rápido precisa
// dela e é uma função pura: importar o contexto arrastaria React e Firebase
// para dentro do teste. O AppContext reexporta, então nada que já importava de
// lá precisou mudar.

// Categoria usada pelos aportes em objetivos. Quem já tem categorias salvas no
// Firestore não recebe a lista nova, então contributeGoal garante a inclusão.
export const GOAL_CATEGORY = 'Objetivos'

export const CATEGORIES = [
  'Salário', 'Freelance', 'Investimentos', 'Outros Rendimentos',
  'Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Lazer',
  'Educação', 'Vestuário', 'Tecnologia', GOAL_CATEGORY, 'Outros',
]

export const CATEGORY_ICONS = {
  'Salário':           'fi-rr-briefcase',
  'Freelance':         'fi-rr-laptop',
  'Investimentos':     'fi-rr-chart-line-up',
  'Outros Rendimentos':'fi-rr-coins',
  'Alimentação':       'fi-rr-fork',
  'Moradia':           'fi-rr-home',
  'Transporte':        'fi-rr-car',
  'Saúde':             'fi-rr-heart-rate',
  'Lazer':             'fi-rr-gamepad',
  'Educação':          'fi-rr-book',
  'Vestuário':         'fi-rr-shopping-bag',
  'Tecnologia':        'fi-rr-mobile',
  'Objetivos':         'fi-rr-bullseye',
  'Outros':            'fi-rr-box',
}
