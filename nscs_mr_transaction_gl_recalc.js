/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/query', 'N/record', 'N/search', 'N/runtime'],
    /**
 * @param{query} query
 * @param{record} record
 * @param{search} search
 * @param{runtime} runtime
 */
    (query, record, search, runtime) => {
        /**
         * Defines the function that is executed at the beginning of the map/reduce process and generates the input data.
         * @param {Object} inputContext
         * @param {boolean} inputContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {Object} inputContext.ObjectRef - Object that references the input data
         * @typedef {Object} ObjectRef
         * @property {string|number} ObjectRef.id - Internal ID of the record instance that contains the input data
         * @property {string} ObjectRef.type - Type of the record instance that contains the input data
         * @returns {Array|Object|Search|ObjectRef|File|Query} The input data to use in the map/reduce process
         * @since 2015.2
         */

        const getInputData = (inputContext) => {
            const querySearchId = runtime.getCurrentScript().getParameter('custscript_nscs_query_search_id');

            return querySearchId.includes("customsearch") ? runSearch(querySearchId) : runQuery(querySearchId);
        }

        /**
         * Defines the function that is executed when the reduce entry point is triggered. This entry point is triggered
         * automatically when the associated map stage is complete. This function is applied to each group in the provided context.
         * @param {Object} reduceContext - Data collection containing the groups to process in the reduce stage. This parameter is
         *     provided automatically based on the results of the map stage.
         * @param {Iterator} reduceContext.errors - Serialized errors that were thrown during previous attempts to execute the
         *     reduce function on the current group
         * @param {number} reduceContext.executionNo - Number of times the reduce function has been executed on the current group
         * @param {boolean} reduceContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {string} reduceContext.key - Key to be processed during the reduce stage
         * @param {List<String>} reduceContext.values - All values associated with a unique key that was passed to the reduce stage
         *     for processing
         * @since 2015.2
         */
        const reduce = (reduceContext) => {
            try {

                const data = JSON.parse(reduceContext.values[0]);

                let recordId = Object.hasOwn(data, 'internalid') ? data.internalid : data.id;

                if (!recordId) {
                    throw new Error("Record id not found.");
                }

                if (!Object.hasOwn(data, 'recordtype')) {
                    throw new Error("Record type not found.");
                }

                let currentRecord = record.load({
                    id: recordId,
                    type: data.recordtype,
                    isDynamic: true
                });

                if (data.istransaction && Object.hasOwn(currentRecord.getMacros(), 'calculateTax')) {
                    currentRecord.executeMacro({id: 'calculateTax'})
                }

                currentRecord.save();
                
            } catch (err) {
                log.error(`Name: ${err.name}`, `Message: ${err.message} Stack: ${err.stack}`);
            }
        }


        /**
         * Defines the function that is executed when the summarize entry point is triggered. This entry point is triggered
         * automatically when the associated reduce stage is complete. This function is applied to the entire result set.
         * @param {Object} summaryContext - Statistics about the execution of a map/reduce script
         * @param {number} summaryContext.concurrency - Maximum concurrency number when executing parallel tasks for the map/reduce
         *     script
         * @param {Date} summaryContext.dateCreated - The date and time when the map/reduce script began running
         * @param {boolean} summaryContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {Iterator} summaryContext.output - Serialized keys and values that were saved as output during the reduce stage
         * @param {number} summaryContext.seconds - Total seconds elapsed when running the map/reduce script
         * @param {number} summaryContext.usage - Total number of governance usage units consumed when running the map/reduce
         *     script
         * @param {number} summaryContext.yields - Total number of yields when running the map/reduce script
         * @param {Object} summaryContext.inputSummary - Statistics about the input stage
         * @param {Object} summaryContext.mapSummary - Statistics about the map stage
         * @param {Object} summaryContext.reduceSummary - Statistics about the reduce stage
         * @since 2015.2
         */
        const summarize = (summaryContext) => {

        }

        const runSearch = (searchId) => {
            const dataSearch = search.load(searchId);

            const data = [];

            const pagedData = dataSearch.runPaged();

            for (let i=0; i < pagedData.pageRanges.length; i++) {
                pagedData.fetch(i).data.forEach((r) => {
                    let result = r.getAllValues();

                    let sanitizedResult = {};

                    Object.keys(result).forEach((c) => {
						sanitizedResult[c] = typeof(result[c]) === 'object' ? result[c][0].value : result[c];
					});
					
                    if (!Object.hasOwn(sanitizedResult, 'recordtype')) {
                        sanitizedResult.recordtype = dataSearch.searchType;
                    }

                    sanitizedResult.istransaction = dataSearch.searchType == 'transaction';

                    data.push(sanitizedResult);
                });
            }

            return data;
        }

        const runQuery = (queryId) => {
            const dataQuery = query.load(queryId);

            const data = [];

            const pagedData = dataQuery.runPaged();

            for (let i=0; i < pagedData.pageRanges.length; i++) {
                pagedData.fetch(i).data.asMappedResults().forEach((result) => {

                    if (!Object.hasOwn(result, 'recordtype')) {
                        result.recordtype = dataQuery.type;
                    }

                    result.istransaction = dataQuery.type == 'transaction';

                    data.push(result);
                });
            }

            return data;
        }

        return {getInputData, reduce, summarize}

    });
