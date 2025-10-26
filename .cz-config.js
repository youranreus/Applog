module.exports = {
  types: [
    { value: 'feat', name: 'feat:       功能啊啊啊' },
    { value: 'fix', name: 'fix:        修复bug啊啊啊啊' },
    {
      value: 'refactor',
      name: 'refactor:   重构啊啊啊啊',
    },
    {
      value: 'chore',
      name: 'chore:      构建相关调整啊啊',
    },
    {
      value: 'style',
      name: 'style:      代码样式调整捏 (空格，格式化，等等)',
    },
    { value: 'docs', name: 'docs:       文档啊啊啊啊' },
    {
      value: 'perf',
      name: 'perf:       性能优化啊啊啊',
    },
    { value: 'revert', name: 'revert:     回退啊啊啊啊' },
  ],

  scopes: [{ name: 'frontend' }, { name: 'backend' }, { name: 'global' }],

  usePreparedCommit: false, // to re-use commit from ./.git/COMMIT_EDITMSG
  allowTicketNumber: false,
  isTicketNumberRequired: false,
  ticketNumberPrefix: 'TICKET-',
  ticketNumberRegExp: '\\d{1,5}',

  // it needs to match the value for field type. Eg.: 'fix'
  /*
  scopeOverrides: {
    fix: [

      {name: 'merge'},
      {name: 'style'},
      {name: 'e2eTest'},
      {name: 'unitTest'}
    ]
  },
  */
  // override the messages, defaults are as follows
  messages: {
    type: '李在干神魔:',
    scope: '\n你在哪里干的 (可选):',
    // used if allowCustomScopes is true
    customScope: '什么地方？:',
    subject: '简单说，我赶时间:\n',
    body: '细说 (可选). 输入 "|" 来换行:\n',
    breaking: '你干了什么好事？ (Breaking-changes，可选):\n',
    footer: '你干了什么好事（喜） (Issues，可选). E.g.: #31, #34:\n',
    confirmCommit: '就这些？',
  },

  allowCustomScopes: true,
  allowBreakingChanges: ['feat', 'fix'],
  // skip any questions you want
  skipQuestions: ['breaking', 'body', 'footer'],

  // limit subject length
  subjectLimit: 100,
  // breaklineChar: '|', // It is supported for fields body and footer.
  // footerPrefix : 'ISSUES CLOSED:'
  // askForBreakingChangeFirst : true, // default is false
}