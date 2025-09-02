// Multiplayer Battleships Test
// This test simulates two players joining a room and playing the game

const { test, expect } = require('@playwright/test');

test('multiplayer battleships flow', async ({ browser }) => {
  // Create two browser contexts to simulate two different players
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();
  
  const player1 = await context1.newPage();
  const player2 = await context2.newPage();
  
  // Both players navigate to the game
  await player1.goto('http://localhost:5173');
  await player2.goto('http://localhost:5173');
  
  // Player 1 creates a room - select Online mode from dropdown
  await player1.selectOption('select', 'ONLINE');
  // Wait for name field and fill it
  await player1.waitForSelector('input');
  await player1.fill('input', 'Player1');
  // Click the blue Create Room button
  await player1.click('button:has-text("Create Room")');
  
  // Wait to be connected and get the room code 
  await player1.waitForSelector('text=/Room:/', { timeout: 10000 });
  const roomCodeElement = await player1.locator('text=/Room: [A-Z0-9]+/');
  const roomCodeText = await roomCodeElement.textContent();
  const roomCode = roomCodeText.replace('Room: ', '').trim();
  
  console.log('Room code:', roomCode);
  
  // Player 2 joins the room
  await player2.selectOption('select', 'ONLINE');
  await player2.waitForSelector('input');
  await player2.fill('input', 'Player2');
  // Switch to Join Room tab and enter room code
  await player2.click('text=Join Room');
  await player2.waitForSelector('input[placeholder*="room"], input[placeholder*="code"]');
  await player2.fill('input[placeholder*="room"], input[placeholder*="code"]', roomCode);
  await player2.click('button:has-text("Join Room")');
  
  // Both players should now be in ship placement phase
  await player1.waitForSelector('.grid, [data-testid="placement-grid"]');
  await player2.waitForSelector('.grid, [data-testid="placement-grid"]');
  
  // Player 1 places ships - manually place ships by clicking grid cells
  // Place ship of length 5 first (horizontal)
  const grid1 = player1.locator('table');
  await grid1.locator('td').nth(0).click(); // A1
  await grid1.locator('td').nth(1).click(); // B1
  await grid1.locator('td').nth(2).click(); // C1
  await grid1.locator('td').nth(3).click(); // D1
  await grid1.locator('td').nth(4).click(); // E1
  
  // Click Done to confirm Player 1's placement
  await player1.click('text=Done');
  
  // Player 2 places ships - manually place ships by clicking grid cells
  const grid2 = player2.locator('table');
  await grid2.locator('td').nth(10).click(); // A2
  await grid2.locator('td').nth(11).click(); // B2
  await grid2.locator('td').nth(12).click(); // C2
  await grid2.locator('td').nth(13).click(); // D2
  await grid2.locator('td').nth(14).click(); // E2
  
  // Click Done to confirm Player 2's placement
  await player2.click('text=Done');
  
  // Now both players should be in the battle phase
  await player1.waitForSelector('.play-view, [data-testid="play-view"], .battle');
  await player2.waitForSelector('.play-view, [data-testid="play-view"], .battle');
  
  // Player 1 takes a turn (click on opponent's grid)
  const opponentGrid1 = player1.locator('.opponent-grid, [data-testid="opponent-grid"]').first();
  await opponentGrid1.locator('.cell, [data-testid*="cell"]').first().click();
  
  // Player 2 should now see it's their turn
  await player2.waitForSelector('text*="Your turn", .your-turn', { timeout: 5000 });
  
  console.log('✅ Multiplayer flow test completed successfully!');
  console.log('- Room created and joined');
  console.log('- Both players placed ships');
  console.log('- Battle phase started');
  console.log('- Turn-based gameplay working');
  
  await context1.close();
  await context2.close();
});