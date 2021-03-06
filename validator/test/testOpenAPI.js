"use strict";

var expect = require('expect.js');
var fs = require('fs');
var path = require('path');
var pathValidator = require('../lib/pathValidator.js');
var jsonHandler = require('../lib/jsonHandler.js');
var fileGetter = require('../lib/fileGetter.js');

var expect = require('chai').expect;

describe("Validating files...", function () {
  it("test suite started", function () {

  })
});

//OPENAPIS //
var dirname = "./jsonschema/apis/";
fs.readdir(dirname, function (err, filenames) {
  if (err) {
    console.log(err);
  }

  console.log('OPENAPI files');
  console.log(filenames);
  filenames.forEach(function (filename) {
    if (filename.includes(".json") && !filename.includes("package")) {
      let openAPIPath = path.join(dirname, filename);

      describe("OpenAPI - " + filename, function () {
        var file = fs.readFileSync(openAPIPath, {
          encoding: 'utf-8'
        });
        var parsedOpenAPI;
        var pathValidatorResult
        var fileGetterResult;

        before(function () {
          parsedOpenAPI = JSON.parse(file);
          pathValidator.clear();
          pathValidatorResult = pathValidator.runThroughPaths(parsedOpenAPI);
          fileGetter.clear();
          fileGetterResult = fileGetter.getAllExternalFiles(pathValidatorResult.schemaObjList);
          pathValidatorResult.schemaObjBody = jsonHandler.buildSchemaObjectBody(pathValidatorResult.schemaObjList, fileGetterResult.apiSchema);
        })

        describe(" - Filename: ", function () {
          it("should start with uppercase letter", function () {
            expect(filename[0]).to.equal(filename[0].toUpperCase());
          });

          it("should contain version (lowercase 'v')", function () {
            let containsVersion = filename.includes("_v");
            expect(containsVersion).to.be.true;
          });
        });

        describe(" - Content Format: ", function () {
          it("should be complient with OpenAPI in version 3.0'", function () {
            expect(parsedOpenAPI).to.have.property("openapi");
            expect(parsedOpenAPI).to.not.have.property("swagger");
          });
        });

        describe(" - Servers: ", function () {
          it("should have a 'servers' property with 'URL' and 'variables'", function () {
            expect(parsedOpenAPI).to.have.property("servers");
            expect(parsedOpenAPI.servers[0]).to.have.property("variables");
            expect(parsedOpenAPI.servers[0]).to.have.property("url");
          });
          it("should have an URL consistent with our model", function () {
            var patt = /(?:.*)\/api\/(?:.*)\/v[0-9]*$/;
            var result = patt.test(parsedOpenAPI.servers[0].url);
            var errorMessage = "Make sure there isn't a '/' in the end of your URL and read this document for more details about a consistent URL: http://tdn.totvs.com.br/pages/releaseview.action?pageId=271660444";
            expect(result, errorMessage).to.be.true;
          });
        });

        describe(" - Version: ", function () {
          it("should contain the same version on 'info' as in filename", function () {
            var fileNameVersion = filename.substr(filename.lastIndexOf("_v") + 2, filename.length)
              .replace("_", ".")
              .replace(".json", "");
            var infoVersion = parsedOpenAPI.info.version;
            expect(fileNameVersion).to.equal(infoVersion);
          });
        });

        describe(" - Endpoints: ", function () {
          it("shouldn't contain 'post', 'put', 'get' or 'delete' in the URL", function () {
            expect(pathValidatorResult.useHttpVerbInEndpointUrl).to.not.equal(true);
          });

          it("should contain success responses for all http verbs", function () {
            expect(pathValidatorResult.foundSuccessResponse).to.be.true;
          });

          it("should specify 'Id' for all PUT or DELETE operations", function () {
            expect(pathValidatorResult.useIdInAllPutsAndDeletes).to.be.true;
          });
        });

        describe(" - Schemas: ", function () {
          it("shouldn't contain 'schemas' definition inside this file", function () {
            if (parsedOpenAPI.components) {
              if (parsedOpenAPI.components.schemas) {
                expect(parsedOpenAPI.components.schemas).to.eql({});
              } else {
                expect(parsedOpenAPI.components.schemas).to.be.an('undefined');
              }
            }
          });

          it("should use external schemas for all requests and responses ", function () {
            expect(pathValidatorResult.useExternalSchema).to.be.true;
          });

          it("should reference valid schema files", function () {
            var errorMessage = "Could not find schemas: ";
            for (var i in fileGetterResult.notFoundSchemas) {
              errorMessage += fileGetterResult.notFoundSchemas[i] + ";"
            }
            expect(fileGetterResult.notFoundSchemas.length, errorMessage).to.equal(0);
          });

          //TODO: Refatorar duplicação de código e muitos loopings acontecendo da mesma iteração. APISchemaBodyValidator
          it("should reference valid objects inside schema file", function () {
            for (var i in pathValidatorResult.schemaObjList) {
              var objectName = pathValidatorResult.schemaObjList[i].objectName;
              var schemaObjectBody = pathValidatorResult.schemaObjList[i].objectBody;
              var ref = pathValidatorResult.schemaObjList[i].ref;
              expect(schemaObjectBody.definitions, "Could not find the object '" + objectName + "' inside the json schema file '" + ref + "'").to.have.property(objectName);
            }
          });

          it("should contain the same Id property name in URL and body", function () {
            for (var i in pathValidatorResult.schemaObjList) {
              var iscolleciton = pathValidatorResult.schemaObjList[i].iscollection;
              if (!iscolleciton) {
                var pathkey = pathValidatorResult.schemaObjList[i].pathkey;
                var pathidkey = pathkey.substr(pathkey.lastIndexOf("/{") + 2, pathkey.length).replace("}", "").replace("{", "");
                var objectName = pathValidatorResult.schemaObjList[i].objectName;
                var schemaObjectBody = pathValidatorResult.schemaObjList[i].objectBody;
                var objectBody = schemaObjectBody.definitions[objectName];
                var properties = objectBody.properties;
                var containsTheSameKeyInUrlAndBody;
                if (properties) { //Had to do this validation because there are some none-collection endpoints which return list as the entity been approved (business requirement)
                  containsTheSameKeyInUrlAndBody = properties.hasOwnProperty(pathidkey);
                  expect(containsTheSameKeyInUrlAndBody, "Check the endpoint '" + pathkey + "'").to.be.true;
                }
              }
            }
          });
          /////////////////

          // it("should contain Id (path param) defined 'params' property", function(){

          // })
        });

        describe(" - Parameters: ", function () {
          it("should have 'pagination', 'query' and 'order' for collection endpoints", function () {
            var collectionsWithoutRequiredParams = "Please check this endpoint: " + pathValidatorResult.collectionsWithoutRequiredParams;
            expect(pathValidatorResult.useAllRequiredParamsForCollection, collectionsWithoutRequiredParams).to.be.true;
          });

          it("should use common parameters", function () {
            var notUsingCommonParams = "Please check this endpoint|httpverb: " + pathValidatorResult.notUsingCommonParams;
            expect(pathValidatorResult.useCommonParams, notUsingCommonParams).to.be.true;
          });
        });

        describe(" - Errors: ", function () {
          it("should use common errors schema", function () {
            expect(pathValidatorResult.useErrorSchema).to.be.true;
          });
        });

        describe(" - xtotvs: ", function () {
          it("should contain xtotvs/productinformation as an array on 'info'", function () {
            expect(parsedOpenAPI.info["x-totvs"].productInformation).to.be.an('array');
          });

          it("should contain xtotvs/productinformation as an array on 'paths'", function () {
            var wrongXTotvs = "Please check this endpoint|httpverb: " + pathValidatorResult.wrongXTotvs;
            expect(pathValidatorResult.useProductInfoAsArray, wrongXTotvs).to.be.true;
          });
        });
      });
    };
  });
});


