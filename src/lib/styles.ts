export function setupStyles(href: string) {
  var styles = document.createElement('link');
  styles.rel = 'stylesheet';
  styles.type = 'text/css';
  styles.media = 'screen';
  styles.href = href;
  document.getElementsByTagName('head')[0].appendChild(styles);
}
