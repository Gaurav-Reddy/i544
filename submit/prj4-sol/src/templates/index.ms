
<!-- -*- mode: html; -*- -->
<!DOCTYPE html>
<html>
  <head>
    <title>CS 544 Spreadsheet Selection</title>
    <link rel="stylesheet" href="/style.css" type="text/css"/>
  </head>
  <body>
    <h1>Gaurav 544 Spreadsheet Selection</h1>
    
    <form action="/" method="POST">
      <label for="ssName">Open Spreadsheet Name</label>
      <span>
	<input name="ssName" value="" id="ssName"/>
	<br/>
	
  {{#errorMessage}}
  <span class="error" id="ssNameError">{{errorMessage}}</span>
  {{/errorMessage}}
  
      </span>
      <input type="submit" value="Open"/>
    </form>
  </body>
</html>
