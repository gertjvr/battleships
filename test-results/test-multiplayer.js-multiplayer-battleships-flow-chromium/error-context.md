# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]: "Mode:"
      - combobox [ref=e7]:
        - option "Two Players"
        - option "Vs Computer"
        - option "Online" [selected]
    - heading "Kids Battleships" [level=1] [ref=e8]
    - generic [ref=e9]:
      - button "Enable Sound" [ref=e10]
      - button "Help" [ref=e12]
      - button "Restart" [ref=e13]
  - generic [ref=e14]:
    - generic [ref=e15]:
      - button "← Back" [ref=e16] [cursor=pointer]
      - heading "Online Battleships" [level=2] [ref=e17]
    - generic [ref=e18]:
      - generic [ref=e19]:
        - generic [ref=e20]: "Your Name:"
        - textbox "Enter your name" [ref=e21]: Player1
      - generic [ref=e22]:
        - button "Create Room" [active] [ref=e23] [cursor=pointer]
        - button "Join Room" [ref=e24] [cursor=pointer]
      - generic [ref=e25]:
        - paragraph [ref=e26]: Create a new game room and share the code with another player
        - button "Create Room" [ref=e27] [cursor=pointer]
```