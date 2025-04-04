import browser from 'webextension-polyfill';

export async function requestHostPermission(host: string) {
  const permissions: browser.Permissions.Permissions = { origins: [host] };
  
  try {
    const hasPermissions = await browser.permissions.contains(permissions);
    if (hasPermissions) return true;
    return await browser.permissions.request(permissions);
  } catch (error) {
    console.error('Error requesting permissions:', error);
    return false;
  }
}