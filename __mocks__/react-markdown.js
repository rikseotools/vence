// __mocks__/react-markdown.js — Mock para Jest (react-markdown es ESM puro)
const React = require('react')

function ReactMarkdown({ children }) {
  return React.createElement('div', { 'data-testid': 'react-markdown' }, children)
}

module.exports = ReactMarkdown
module.exports.default = ReactMarkdown
