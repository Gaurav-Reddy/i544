
<!-- -*- mode: html; -*- -->
<!DOCTYPE html>
<html>
  <head>
    <title>CS 444/544 Spreadsheet Updata</title>
    <link rel="stylesheet" href="/style.css" type="text/css"/>
  </head>
  <body>
    <h1>CS 444/544 Spreadsheet Update for {{name}}</h1>
    <p><a id="ss-act" href="/">Open other spreadsheet</a></p>
    <table class="ss">
      {{#table}}
        <tr>
          {{{row}}}
        </tr>
      {{/table}}
    </table>
    <p class="error"></p>
    <form action="/ss/{{name}}" method="POST">
      <label for="ssAct">Action</label>
      <span>
	<fieldset>
          <div>
	    <input name="ssAct" type="radio" 
		   id="actClear" value="clear" {{#clear}}checked{{/clear}}>
	    <label for="actClear">Clear Spreadsheet</label>
          </div>
          <div>
            <input name="ssAct" type="radio"  
		   id="actDelete" value="deleteCell" {{#deleteCell}}checked{{/deleteCell}}>
	    <label for="act">Delete Cell</label>
          </div>
          <div>
	    <input name="ssAct" type="radio"  
		   id="actUpdate" value="updateCell" {{#updateCell}}checked{{/updateCell}}>
	    <label for="actUpdate">Update Cell</label>
          </div>
        <div>
	  <input name="ssAct" type="radio" 
		 id="actCopy" value="copyCell" {{#copyCell}}checked{{/copyCell}}>
	  <label for="actCopy">Copy Cell</label>
        </div>
	</fieldset>
	<br/>
	<span class="error" id="ssActError">{{#ssAct}}{{ssAct}}{{/ssAct}}</span>
      </span>
      <label for="cellId">Destination Cell ID</label>
      <span>
	<input name="cellId" value="{{sentCellId}}" id="cellId"/>
	<br/>
	<span class="error" id="cellIdError">{{#cellId}}{{cellId}}{{/cellId}}</span>
      </span>
      <label for="formula">Formula</label>
      <span>
	<input name="formula" value="{{sentFormula}}" id="formula"/>
	<br/>
	<span class="error" id="formulaError">{{#formula}}{{formula}}{{/formula}}</span>
      </span>
      <label>&nbsp;</label>
      <input type="submit" value="Update"/>
    </form>
  </body>
</html>
