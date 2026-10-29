/** Tools inside a collapsed mobile menu cannot receive focus. */
export function focusPageTool(button){
 const menu=button.closest('.mobile-tools-panel');
 const target=menu&&(menu.inert||menu.hidden)?menu.parentElement.querySelector('.mobile-tools-toggle'):button;
 target?.focus({preventScroll:true});
}
