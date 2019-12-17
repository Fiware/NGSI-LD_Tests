const testedResource = require('../common.js').testedResource;
const http = require('../http.js');

const entitiesResource = testedResource + '/entities/';

const JSON_LD_HEADERS = {
    'Content-Type': 'application/ld+json'
};

const ACCEPT_LD = {
    Accept: 'application/ld+json'
};

// Patches the object and returns a new copy of the patched object
// TECHNICAL DEBT: It should be imported from common.js
function patchObj(target, patch) {
    const copy = JSON.parse(JSON.stringify(target));
    return Object.assign(copy, patch);
}

describe('Append Entity Attributes. JSON-LD @context', () => {
    const entity = {
        id: 'urn:ngsi-ld:T:' + new Date().getTime(),
        type: 'T',
        P1: {
            type: 'Property',
            value: 12,
            observedAt: '2018-12-04T12:00:00Z',
            P1_R1: {
                type: 'Relationship',
                object: 'urn:ngsi-ld:T2:6789'
            },
            P1_P1: {
                type: 'Property',
                value: 0.79
            }
        },
        '@context': 'https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld'
    };

    const appendedAttributes = {
        R1: {
            type: 'Relationship',
            object: 'urn:ngsi-ld:T2:6789',
            R1_R1: {
                type: 'Relationship',
                object: 'urn:ngsi-ld:T3:A2345'
            },
            R1_P1: {
                type: 'Property',
                value: false
            }
        },
        location: {
            type: 'GeoProperty',
            value: {
                type: 'Point',
                coordinates: [-8.01, 40.01]
            }
        },
        '@context': 'https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld'
    };

    // The Entity Id has to be properly encoded
    const entityId = encodeURIComponent(entity.id);

    beforeAll(() => {
        return http.post(entitiesResource, entity, JSON_LD_HEADERS);
    });

    afterAll(() => {
        return http.delete(entitiesResource + entityId);
    });

    it('All Attributes are appended. Same JSON-LD @context. 204', async function() {
        const response = await http.post(`${entitiesResource}${entityId}/attrs/`, appendedAttributes, JSON_LD_HEADERS);

        expect(response.response).toHaveProperty('statusCode', 204);

        const checkResponse = await http.get(`${entitiesResource}${entityId}`, ACCEPT_LD);

        const finalEntity = patchObj(entity, appendedAttributes);
        expect(checkResponse.body).toEqual(finalEntity);
    });

    it('Attributes are overwritten. Same JSON-LD @context. 204', async function() {
        const overwrittenAttrs = {
            P1: {
                type: 'Property',
                value: 'Hola'
            },
            '@context': 'https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld'
        };
        const response = await http.post(`${entitiesResource}${entityId}/attrs/`, overwrittenAttrs, JSON_LD_HEADERS);
        expect(response.response).toHaveProperty('statusCode', 204);

        const checkResponse = await http.get(`${entitiesResource}${entityId}`, ACCEPT_LD);
        const finalEntity = patchObj(entity, overwrittenAttrs);
        expect(checkResponse.body).toEqual(finalEntity);
    });

    it('Attributes should not be overwritten. Partial success. 207', async function() {
        const overwrittenAttrs = {
            P1: {
                type: 'Property',
                value: 'Hola'
            },
            '@context': 'https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld'
        };
        const response = await http.post(
            `${entitiesResource}${entityId}/attrs/?options=noOverwrite`,
            overwrittenAttrs,
            JSON_LD_HEADERS
        );
        expect(response.response).toHaveProperty('statusCode', 207);

        expect(response.body).toHaveProperty('updated', []);
        expect(response.body.notUpdated).toHaveLength(1);
        expect(response.body.notUpdated[0]).toHaveProperty('attributeName', 'P1');
    });

    it('append Entity Attributes in another JSON-LD @context. 204', async function() {
        const overwrittenAttrs = {
            areaServed: {
                type: 'Property',
                value: 'A1'
            },
            '@context': 'https://schema.org'
        };
        const response = await http.post(`${entitiesResource}${entityId}/attrs/`, overwrittenAttrs, JSON_LD_HEADERS);
        expect(response.response).toHaveProperty('statusCode', 204);

        const checkResponse = await http.get(entitiesResource + entityId, ACCEPT_LD);
        const responseEntity = checkResponse.body;
        expect(responseEntity['@context']).toContain('https://schema.org');

        expect(responseEntity.areaServed).toBeDefined();
        expect(responseEntity.areaServed).toHaveProperty('value', overwrittenAttrs.areaServed.value);
    });
});
