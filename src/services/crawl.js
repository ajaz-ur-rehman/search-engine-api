// Load Modules
const axios = require('axios');
const cheerio = require('cheerio');
const validator = require('validator');

// Load Models
const { Link } = require('../models');

// Create Service
class Crawl {
	static async getLinksForCrawling(limit) {
		// Fetch All Links That Needs To Be Crawled (Upto Limit)
		const links = await Link.findAll({
			where: {
				status: 'CRAWL',
			},
			limit,
		});

		return links;
	}

	static async setStatusToCrawling(links) {
		// Extract Link ID's
		const ids = links.map(link => link.id);

		// Update All Links Status To 'CRAWLING' That Matches The ID's
		const result = await Link.update(
			{
				status: 'CRAWLING',
			},
			{
				where: {
					id: ids,
					status: 'CRAWL',
				},
				returning: true,
			}
		);

		return result;
	}

	static async crawlLinks(links) {
		await links.forEach(async link => {
			const address = `https://${link.address}`;
			const { data } = await axios.get(address).catch(e => {
				console.error(e);
				return {};
			});

			if (data) {
				const $ = cheerio.load(data); // Parse HTML
				const childLinks = {}; // Using Object To Keep Links Unique On Push

				$('a').each((index, anchor) => {
					// Get Link Without Query String Or Get 'null' If Link Is Invalid
					const childLink = this.cleanLink(
						$(anchor).attr('href').trim().toLowerCase()
					);

					if (childLink) {
						childLinks[childLink] = ''; // Add Link To childLinks Object
					}
				});

				childLinks = Object.keys(childLinks); // Extract All Links In Array Form
				const text = $('body').text().trim();
			}
		});
	}

	static cleanLink(link) {
		if (validator.isURL(link)) {
			return this.removeQueryFromLink(link);
		} else {
			return null;
		}
	}

	static removeQueryFromLink(link) {
		return link.split(/[?#]/)[0]; // Remove Query String & Pound Sign From URL
	}

	static async addLinks(links) {
		links = this.transformLinksForDatabaseInsertion(links);
		const result = await Link.bulkCreate(links, {
			updateOnDuplicate: ['address'], // Don't Update Any Field If Link Already Exists
		});

		return result;
	}

	static getValidLinks(links) {
		links = links
			.map(link => link.toLowerCase().trim()) // Transform Links
			.filter(link => validator.isURL(link)); // Filter Valid Links

		return links;
	}

	static transformLinksForDatabaseInsertion(links) {
		// Transform Simple Array Into Array Of Objects For Bulk Create
		links = links.map(link => {
			link = link.replace(/^(?:https?:\/\/)?(?:www\.)?/i, ''); // Remove 'http://', 'https://', 'www.' Etc From Link

			return {
				address: link, // Address Is The Column Name Inside Link Model To Store URL's
			};
		});

		return links;
	}
}

// Export Service
module.exports = Crawl;
